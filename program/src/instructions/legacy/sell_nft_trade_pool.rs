//! Sell a Metaplex legacy or pNFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
//! owner of the NFT.
//!
//! The seller is the owner of the NFT and receives the pool's current price in return.
//! This is separated from Token pool since the NFT will go into an NFT escrow w/ a receipt.

// (!) Keep common logic in sync with sell_nft_token_pool.rs.
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface},
};
use escrow_program::instructions::assert_decode_margin_account;
use mpl_token_metadata::types::AuthorizationData;
use tensor_escrow::instructions::{
    WithdrawMarginAccountCpiTammCpi, WithdrawMarginAccountCpiTammInstructionArgs,
};
use tensor_toolbox::{
    token_metadata::{assert_decode_metadata, transfer, TransferArgs},
    transfer_creators_fee, transfer_lamports_from_pda, CreatorFeeMode, FromAcc,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt};

use crate::{constants::MAKER_BROKER_PCT, error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTradePool<'info> {
    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    // Trade shared accounts
    pub trade: TradeShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = trade.taker,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    // The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == taker_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account of the seller, where the NFT will be transferred from.
    #[account(
        mut,
        token::mint = mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be transferred to.
    #[account(
        init_if_needed,
        payer = trade.taker,
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
}

impl<'info> SellNftTradePool<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_sell(&PoolType::Trade)?;
        self.trade
            .verify_whitelist(&self.mplx, Some(self.mint.to_account_info()))
    }
}

/// Sell a Metaplex legacy NFT or pNFT into a Trade pool.
#[access_control(ctx.accounts.pre_process_checks())]
pub fn process_sell_nft_trade_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.trade.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Sell)?;

    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    let mm_fee = pool.calc_mm_fee(current_price)?;

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.mplx.metadata)?;
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
    record_event(
        event,
        &ctx.accounts.trade.amm_program,
        &ctx.accounts.trade.pool,
    )?;

    // Check that the total price the seller receives isn't lower than the min price the user specified.
    let price = unwrap_checked!({ current_price.checked_sub(mm_fee)?.checked_sub(creators_fee) });

    if price < min_price {
        return Err(ErrorCode::PriceMismatch.into());
    }

    // transfer nft to pool
    // has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    let seller = &ctx.accounts.trade.taker.to_account_info();
    let destination = &ctx.accounts.trade.pool.to_account_info();

    transfer(
        TransferArgs {
            payer: seller,
            source: seller,
            source_ata: &ctx.accounts.taker_ta,
            destination,
            destination_ata: &ctx.accounts.pool_ta, //<- send to pool as escrow first
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.mplx.metadata,
            edition: &ctx.accounts.mplx.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.mplx.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.mplx.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.mplx.user_token_record.as_ref(),
            destination_token_record: ctx.accounts.mplx.pool_token_record.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_data: authorization_data.clone().map(AuthorizationData::from),
            delegate: None,
        },
        None,
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.
    token_interface::close_account(ctx.accounts.trade.close_taker_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.taker_ta.to_account_info(),
    ))?;

    // --------------------------------------- SOL transfers

    // Signer seeds for the pool account.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // If the source funds are from a shared escrow account, we first transfer from there
    // to the pool, to make payments cleaner. After this, we can always send from the pool
    // so the logic is simpler.
    if pool.shared_escrow != Pubkey::default() {
        let incoming_shared_escrow = unwrap_opt!(
            ctx.accounts.trade.shared_escrow.as_ref(),
            ErrorCode::BadSharedEscrow
        )
        .to_account_info();

        let escrow_program = unwrap_opt!(
            ctx.accounts.trade.escrow_program.as_ref(),
            ErrorCode::EscrowProgramNotSet
        )
        .to_account_info();

        // Validate it's a valid escrow account.
        assert_decode_margin_account(
            &incoming_shared_escrow,
            &ctx.accounts.trade.owner.to_account_info(),
        )?;

        // Validate it's the correct account: the stored escrow account matches the one passed in.
        if incoming_shared_escrow.key != &pool.shared_escrow {
            throw_err!(ErrorCode::BadSharedEscrow);
        }

        // Withdraw from escrow account to pool.
        WithdrawMarginAccountCpiTammCpi {
            __program: &escrow_program,
            margin_account: &incoming_shared_escrow,
            pool: &ctx.accounts.trade.pool.to_account_info(),
            owner: &ctx.accounts.trade.owner.to_account_info(),
            destination: &ctx.accounts.trade.pool.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            __args: WithdrawMarginAccountCpiTammInstructionArgs {
                bump: pool.bump[0],
                pool_id: pool.pool_id,
                lamports: current_price,
            },
        }
        .invoke_signed(signer_seeds)?;
    };

    /*  **Transfer Fees**
    The sell price is the total price the seller receives for selling the NFT into the pool.

    sell_price = current_price - taker_fee - mm_fee - creators_fee

    taker_fee = tamm_fee + maker_broker_fee + taker_broker_fee

    Fees are paid by deducting them from the current price, with the final remainder
    then being sent to the seller.

    */

    let mut left_for_seller = current_price;

    // TAmm contract fee.
    transfer_lamports_from_pda(
        &ctx.accounts.trade.pool.to_account_info(),
        &ctx.accounts.trade.fee_vault.to_account_info(),
        tamm_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(tamm_fee));

    // Broker fees. Transfer if accounts are specified, otherwise the funds go to the fee_vault.
    transfer_lamports_from_pda(
        &ctx.accounts.trade.pool.to_account_info(),
        ctx.accounts
            .trade
            .maker_broker
            .as_ref()
            .unwrap_or(&ctx.accounts.trade.fee_vault),
        maker_broker_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(maker_broker_fee));

    transfer_lamports_from_pda(
        &ctx.accounts.trade.pool.to_account_info(),
        ctx.accounts
            .trade
            .taker_broker
            .as_ref()
            .unwrap_or(&ctx.accounts.trade.fee_vault),
        taker_broker_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_broker_fee));

    // Transfer royalties
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    let actual_creators_fee = transfer_creators_fee(
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
            from: &FromAcc::Pda(&ctx.accounts.trade.pool.to_account_info()),
        },
    )?;

    // Taker pays royalties, so we subtract them from the amount left for the seller.
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(actual_creators_fee));

    // Taker pays MM fee, so we subtract it from the amount left for the seller.
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(mm_fee));

    //Transfer remainder to seller
    // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
    // (!) maker rebate already taken out of this amount
    transfer_lamports_from_pda(
        &ctx.accounts.trade.pool.to_account_info(),
        &ctx.accounts.trade.taker.to_account_info(),
        left_for_seller,
    )?;

    // If MM fees are compounded they go to the pool or shared escrow, otherwise to the owner.
    if pool.config.mm_compound_fees {
        msg!("Compounding MM fees");
        // Send back to shared escrow
        if pool.shared_escrow != Pubkey::default() {
            let incoming_shared_escrow = unwrap_opt!(
                ctx.accounts.trade.shared_escrow.as_ref(),
                ErrorCode::BadSharedEscrow
            )
            .to_account_info();

            transfer_lamports_from_pda(
                &ctx.accounts.trade.pool.to_account_info(),
                &incoming_shared_escrow,
                mm_fee,
            )?;
        }
        // Otherwise, already in the pool so no transfer needed.
    } else {
        msg!("Sending mm fees to the owner");
        // Send to owner
        transfer_lamports_from_pda(
            &ctx.accounts.trade.pool.to_account_info(),
            &ctx.accounts.trade.owner.to_account_info(),
            mm_fee,
        )?;
    }

    // --------------------------------------- accounting

    //create nft receipt for trade pool
    let receipt_state = &mut ctx.accounts.nft_receipt;
    receipt_state.bump = ctx.bumps.nft_receipt;
    receipt_state.mint = ctx.accounts.mint.key();
    receipt_state.pool = ctx.accounts.trade.pool.key();

    //update pool accounting
    let pool = &mut ctx.accounts.trade.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    // Pool has bought an NFT, so we decrement the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_sub(1));

    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    pool.stats.accumulated_mm_profit =
        unwrap_int!(pool.stats.accumulated_mm_profit.checked_add(mm_fee));

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
        let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
        let pool_final_balance = pool.get_lamports();
        let lamports_taken = unwrap_int!(pool_initial_balance.checked_sub(pool_final_balance));
        pool.amount = unwrap_int!(pool.amount.checked_sub(lamports_taken));

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
            ErrorCode::InvalidPoolAmount
        );
    }

    Ok(())
}
