//! Buy a Metaplex legacy NFT or pNFT from a NFT or Trade pool.
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface},
};
use escrow_program::instructions::assert_decode_margin_account;
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{
    close_account,
    token_metadata::{assert_decode_metadata, transfer, TransferArgs},
    transfer_creators_fee, transfer_lamports, transfer_lamports_checked, CreatorFeeMode, FromAcc,
    FromExternal,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt};

use crate::{constants::MAKER_BROKER_PCT, error::ErrorCode, *};

/// Instruction accounts
#[derive(Accounts)]
pub struct BuyNft<'info> {
    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds = [
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // Check that the mint and pool match the nft receipt.
        has_one = mint @ ErrorCode::WrongMint,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == taker_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The TA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mint,
        associated_token::authority = trade.taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT is held.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trade.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Either the legacy token program or token-2022.
    pub token_program: Interface<'info, TokenInterface>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
    //
    // remaining accounts:
    // optional 0 to N creator accounts
}

impl<'info> BuyNft<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_buy()
    }
}

/// Allows a buyer to purchase a Metaplex legacy NFT or pNFT from a Trade or NFT pool.
#[access_control(ctx.accounts.pre_process_checks())]
pub fn process_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNft<'info>>,
    max_amount: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.trade.pool;
    let pool_initial_balance = pool.get_lamports();

    let owner = ctx.accounts.trade.owner.to_account_info();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let taker = ctx.accounts.trade.taker.to_account_info();
    let fee_vault = ctx.accounts.trade.fee_vault.to_account_info();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Buy)?;

    // Protocol and broker fees.
    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    // This resolves to 0 for NFT pools.
    let mm_fee = pool.calc_mm_fee(current_price)?;

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.mplx.metadata)?;
    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch check for easy debugging eg if there's a lot of slippage
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee,
    });

    // Self-CPI log the event.
    record_event(
        event,
        &ctx.accounts.trade.amm_program,
        &ctx.accounts.trade.pool,
    )?;

    // Check that the  price + royalties + mm_fee doesn't exceed the max amount the user specified to prevent sandwich attacks.
    let price = unwrap_checked!({ current_price.checked_add(mm_fee)?.checked_add(creators_fee) });

    if price > max_amount {
        throw_err!(ErrorCode::PriceMismatch);
    }

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // Transfer nft to buyer
    // Has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    transfer(
        TransferArgs {
            payer: &taker,
            source: &ctx.accounts.trade.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ta,
            destination: &taker,
            destination_ata: &ctx.accounts.taker_ta,
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.mplx.metadata,
            edition: &ctx.accounts.mplx.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.mplx.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.mplx.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.mplx.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.mplx.user_token_record.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // close nft escrow account
    token_interface::close_account(
        ctx.accounts
            .trade
            .close_pool_ata_ctx(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pool_ta.to_account_info(),
            )
            .with_signer(signer_seeds),
    )?;

    /*  **Transfer Fees**
    The buy price is the total price the buyer pays for buying the NFT from the pool.

    buy_price = current_price + taker_fee + mm_fee + creators_fee

    taker_fee = tamm_fee + broker_fee + maker_rebate

    Fees are paid by individual transfers as they go to various accounts depending on the pool type
    and configuration.

    */

    // Determine the SOL destination: owner, pool, or shared escrow account.
    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        // Send money direct to seller/owner
        PoolType::NFT => ctx.accounts.trade.owner.to_account_info(),
        // Send money to the pool
        PoolType::Trade => {
            if pool.shared_escrow != Pubkey::default() {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.trade.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(&incoming_shared_escrow, &owner)?;

                if incoming_shared_escrow.key != &pool.shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                incoming_shared_escrow
            } else {
                ctx.accounts.trade.pool.to_account_info()
            }
        }

        PoolType::Token => unreachable!(),
    };

    // Buyer is the taker and pays the taker fee: tamm_fee + maker_broker_fee + taker_broker_fee.
    transfer_lamports(&taker, &fee_vault, tamm_fee)?;

    transfer_lamports_checked(
        &taker,
        ctx.accounts
            .trade
            .maker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&fee_vault),
        maker_broker_fee,
    )?;

    transfer_lamports_checked(
        &taker,
        ctx.accounts
            .trade
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&fee_vault),
        taker_broker_fee,
    )?;

    // transfer royalties (on top of current price)
    // Buyer pays the royalty fee.
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    transfer_creators_fee(
        &metadata
            .creators
            .clone()
            .unwrap_or(Vec::new())
            .into_iter()
            .map(Into::into)
            .collect(),
        remaining_accounts,
        creators_fee,
        &CreatorFeeMode::Sol {
            from: &FromAcc::External(&FromExternal {
                from: &taker,
                sys_prog: &ctx.accounts.system_program,
            }),
        },
    )?;

    // Price always goes to the destination: NFT pool --> owner, Trade pool --> either the pool or the escrow account.
    transfer_lamports(&taker, &destination, current_price)?;

    // Trade pools need to check compounding fees
    if matches!(pool.config.pool_type, PoolType::Trade) {
        // If MM fees are compounded they go to the destination to remain
        // in the pool or escrow.
        if pool.config.mm_compound_fees {
            transfer_lamports(&taker, &destination, mm_fee)?;
        } else {
            // If MM fees are not compounded they go to the owner.
            transfer_lamports(&taker, &owner, mm_fee)?;
        }
    }

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.trade.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Pool has sold an NFT, so we increment the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_add(1));

    pool.stats.taker_buy_count = unwrap_int!(pool.stats.taker_buy_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    if pool.config.pool_type == PoolType::Trade {
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
        let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
        let pool_final_balance = pool.get_lamports();
        let lamports_added =
            unwrap_checked!({ pool_final_balance.checked_sub(pool_initial_balance) });
        pool.amount = unwrap_checked!({ pool.amount.checked_add(lamports_added) });

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
            ErrorCode::InvalidPoolAmount
        );
    }

    // Close the NFT receipt account.
    close_account(
        &mut ctx.accounts.nft_receipt.to_account_info(),
        &mut ctx.accounts.trade.taker.to_account_info(),
    )?;

    // If the pool is an NFT pool, and no remaining NFTs held, we can close it.
    try_autoclose_pool(pool, ctx.accounts.trade.rent_payer.to_account_info(), owner)
}
