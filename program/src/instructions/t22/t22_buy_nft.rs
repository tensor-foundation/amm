//! Buy a Token22 NFT from a NFT or Trade pool.
use crate::{calc_taker_fees, constants::MAKER_BROKER_PCT, error::ErrorCode, *};

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, Token2022, TokenAccount, TransferChecked},
};
use escrow_program::instructions::assert_decode_margin_account;
use tensor_toolbox::{
    calc_creators_fee, close_account,
    token_2022::{transfer::transfer_checked, validate_mint, RoyaltyInfo},
    transfer_creators_fee, transfer_lamports, transfer_lamports_checked, CreatorFeeMode, FromAcc,
    FromExternal, TCreator,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt};

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftT22<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // Check the receipt is for the correct pool and mint.
        has_one = mint @ ErrorCode::WrongMint,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The mint account of the NFT.
    #[account(
        constraint = mint.key() == taker_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
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

    /// The TA of the pool, where the NFT will be escrowed.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trade.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> BuyNftT22<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_buy()
    }
}

/// Buy a Token22 NFT from a NFT or Trade pool.
#[access_control(ctx.accounts.pre_process_checks())]
pub fn process_t22_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNftT22<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let pool = &ctx.accounts.trade.pool;
    let pool_initial_balance = pool.get_lamports();

    let owner = ctx.accounts.trade.owner.to_account_info();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let taker = ctx.accounts.trade.taker.to_account_info();
    let fee_vault = ctx.accounts.trade.fee_vault.to_account_info();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Buy)?;

    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    // This resolves to 0 for NFT pools.
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // Validate mint account and determine if royalites need to be paid.
    let royalties = validate_mint(&ctx.accounts.mint.to_account_info())?;

    // Transfer the NFT.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // Setup the transfer CPI
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.pool_ta.to_account_info(),
            to: ctx.accounts.taker_ta.to_account_info(),
            authority: ctx.accounts.trade.pool.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    // this will only add the remaining accounts required by a transfer hook if we
    // recognize the hook as a royalty one
    let (creators, creator_accounts, creators_fee) = if let Some(RoyaltyInfo {
        creators,
        seller_fee,
    }) = &royalties
    {
        // add remaining accounts to the transfer cpi
        transfer_cpi = transfer_cpi.with_remaining_accounts(ctx.remaining_accounts.to_vec());

        let mut creator_infos = Vec::with_capacity(creators.len());
        let mut creator_data = Vec::with_capacity(creators.len());
        // filter out the creators accounts; the transfer will fail if there
        // are missing creator accounts – i.e., the creator is on the `creator_data`
        // but the account is not in the `creator_infos`
        creators.iter().for_each(|c| {
            let creator = TCreator {
                address: c.0,
                share: c.1,
                verified: true,
            };

            if let Some(account) = ctx
                .remaining_accounts
                .iter()
                .find(|account| &creator.address == account.key)
            {
                creator_infos.push(account.clone());
            }

            creator_data.push(creator);
        });

        // No optional royalties.
        let creators_fee = calc_creators_fee(*seller_fee, current_price, None, Some(100))?;

        (creator_data, creator_infos, creators_fee)
    } else {
        (vec![], vec![], 0)
    };

    // For keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
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

    // Perform the transfer
    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
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

    The mm_fee is the fee paid to the MM for providing liquidity to the pool and only applies to Trade pools.

    Fees are paid by individual transfers as they go to various accounts depending on the pool type
    and configuration.
    */

    // Determine the SOL destination: owner, pool or shared escrow account.
    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        //send money direct to seller/owner
        PoolType::NFT => ctx.accounts.trade.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => {
            if pool.shared_escrow != Pubkey::default() {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.trade.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(
                    &incoming_shared_escrow,
                    &ctx.accounts.trade.owner.to_account_info(),
                )?;

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

    // Pay creators royalties.
    if royalties.is_some() {
        transfer_creators_fee(
            &creators,
            &mut creator_accounts.iter(),
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::External(&FromExternal {
                    from: &ctx.accounts.trade.taker.to_account_info(),
                    sys_prog: &ctx.accounts.system_program,
                }),
            },
        )?;
    }

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

    //record the entirety of MM fee during the buy tx
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
        &mut ctx.accounts.trade.owner.to_account_info(),
    )?;

    try_autoclose_pool(
        pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        ctx.accounts.trade.owner.to_account_info(),
    )
}
