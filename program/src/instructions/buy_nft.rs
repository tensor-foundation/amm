//! User buying an NFT from an NFT/Trade pool
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{
    token_metadata::{assert_decode_metadata, transfer, TransferArgs},
    transfer_creators_fee, CreatorFeeMode, FromAcc, FromExternal,
};
use vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt, Validate};

use crate::{error::ErrorCode, *};

use self::{
    constants::{CURRENT_POOL_VERSION, MAKER_BROKER_PCT},
    program::AmmProgram,
};

use super::*;

/// Allows a buyer to purchase an NFT from a Trade or NFT pool.
#[derive(Accounts)]
pub struct BuyNft<'info> {
    /// Owner is the pool owner who created the pool and the nominal owner of the
    /// escrowed NFT. In this transaction they are the seller, though the transfer
    /// of the NFT is handled by the pool.
    /// CHECK: has_one = owner in pool (owner is the seller)
    pub owner: UncheckedAccount<'info>,

    /// Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the mint as the fee shard number
            shard_num!(mint),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        // can only buy from NFT/Trade pool
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The ATA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT is held.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ata, pool_ata and the mint stored in the nft receipt.
    #[account(
        constraint = mint.key() == buyer_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The Token Metadata metadata account of the NFT.
    ///  CHECK: seeds and ownership are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// The NFT deposit receipt account, which tracks an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        //can't buy an NFT that's associated with a different pool
        // redundant but extra safety
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        close = owner,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // --------------------------------------- pNft

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata token record for the pool.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the buyer.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub buyer_token_record: Option<UncheckedAccount<'info>>,

    // Todo: add ProgNftShared back in, if possible

    // pub pnft_shared: ProgNftShared<'info>,
    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4) shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Must match the pool's maker_broker
    #[account(
        mut,
        constraint = Some(&maker_broker.key()) == pool.maker_broker.value() @ ErrorCode::WrongBrokerAccount,
    )]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    pub amm_program: Program<'info, AmmProgram>,
    // remaining accounts:
    // optional 0 to N creator accounts.
}

impl<'info> BuyNft<'info> {
    fn close_pool_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.pool_ata.to_account_info(),
                destination: self.buyer.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    fn transfer_lamports(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        invoke(
            &system_instruction::transfer(self.buyer.key, to.key, lamports),
            &[
                self.buyer.to_account_info(),
                to.clone(),
                self.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }

    /// transfers lamports, skipping the transfer if not rent exempt
    fn transfer_lamports_min_balance(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        let rent = Rent::get()?.minimum_balance(to.data_len());
        if unwrap_int!(to.lamports().checked_add(lamports)) < rent {
            //skip current creator, we can't pay them
            return Ok(());
        }
        self.transfer_lamports(to, lamports)?;
        Ok(())
    }
}

impl<'info> Validate<'info> for BuyNft<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNft<'info>>,
    // Max vs exact so we can add slippage later.
    max_price: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();

    let owner_pubkey = ctx.accounts.owner.key();

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.metadata)?;

    let current_price = pool.current_price(TakerSide::Buy)?;
    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;
    let mm_fee = if pool.config.pool_type == PoolType::Trade {
        pool.calc_mm_fee(current_price)?
    } else {
        0
    };

    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee,
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;

    if current_price > max_price {
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
            payer: &ctx.accounts.buyer.to_account_info(),
            source: &ctx.accounts.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ata,
            destination: &ctx.accounts.buyer,
            destination_ata: &ctx.accounts.buyer_ata,
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.metadata,
            edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.buyer_token_record.as_ref(),
            authorization_rules: ctx.accounts.authorization_rules.as_ref(),
            authorization_rules_program: ctx.accounts.authorization_rules_program.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // close nft escrow account
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    /*  **Transfer Fees**
    The buy price is the total price the buyer pays for buying the NFT from the pool.

    buy_price = current_price + taker_fee + mm_fee + creators_fee

    taker_fee = tamm_fee + broker_fee + maker_rebate

    Fees are paid by individual transfers as they go to various accounts depending on the pool type
    and configuration.

    */

    // Determine the SOL destination: owner, pool or shared escrow account.
    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        //send money direct to seller/owner
        PoolType::NFT => ctx.accounts.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => match &pool.shared_escrow.value() {
            Some(stored_shared_escrow) => {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(
                    &incoming_shared_escrow,
                    &ctx.accounts.owner.to_account_info(),
                )?;

                if incoming_shared_escrow.key != *stored_shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                incoming_shared_escrow
            }
            None => ctx.accounts.pool.to_account_info(),
        },
        PoolType::Token => unreachable!(),
    };

    // Buyer pays the taker fee: tamm_fee + maker_broker_fee + taker_broker_fee.
    ctx.accounts
        .transfer_lamports(&ctx.accounts.fee_vault.to_account_info(), tamm_fee)?;
    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .maker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
        maker_broker_fee,
    )?;
    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
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
                from: &ctx.accounts.buyer.to_account_info(),
                sys_prog: &ctx.accounts.system_program,
            }),
        },
    )?;

    // Price always goes to the destination: NFT pool --> owner, Trade pool --> either the pool or the escrow account.
    ctx.accounts
        .transfer_lamports(&destination, current_price)?;

    // Trade pools need to check compounding fees
    if matches!(pool.config.pool_type, PoolType::Trade) {
        // If MM fees are compounded they go to the destination to remain
        // in the pool or escrow.
        if pool.config.mm_compound_fees {
            ctx.accounts
                .transfer_lamports(&destination.to_account_info(), mm_fee)?;
        } else {
            // If MM fees are not compounded they go to the owner.
            ctx.accounts
                .transfer_lamports(&ctx.accounts.owner.to_account_info(), mm_fee)?;
        }
    }

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Pool has sold an NFT, so we increment the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_add(1));

    pool.stats.taker_buy_count = unwrap_int!(pool.stats.taker_buy_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    if pool.config.pool_type == PoolType::Trade {
        let mm_fee = pool.calc_mm_fee(current_price)?;
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency.is_sol() && pool.shared_escrow.value().is_none() {
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

    try_autoclose_pool(
        pool,
        ctx.accounts.rent_payer.to_account_info(),
        ctx.accounts.owner.to_account_info(),
    )
}
