//! Sell a Token 2022 NFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
//! owner of the NFT.
//!
//! The seller is the owner of the NFT and receives the pool's current price in return.
//! This is separated from Token pool since the asset will be transferred to the pool and
//! a deposit receipt is created for it.

use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct SellNftTradePoolT22<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// T22 shared accounts.
    pub t22: T22Shared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = trade.taker,
        seeds=[
            b"nft_receipt".as_ref(),
            t22.mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump,
        space = NftDepositReceipt::SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The token account of the NFT for the seller's wallet.
    #[account(
        mut,
        token::mint = t22.mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be transferred to.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = t22.mint,
        associated_token::authority = trade.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Token 2022 program.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> SellNftTradePoolT22<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_sell(&PoolType::Trade)?;

        let asset = self.t22.validate_asset()?;

        self.trade.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Sell a Token22 NFT into a Trade pool.
pub fn process_sell_nft_trade_pool_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        min_price,
        TakerSide::Sell,
        Some(100),
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();

    // Transfer to the pool.
    let creator_accounts = transfer(
        &TransferArgs {
            from: ctx.accounts.taker_ta.to_account_info(),
            to: ctx.accounts.pool_ta.to_account_info(),
            authority: ctx.accounts.trade.taker.to_account_info(),
            mint: ctx.accounts.t22.mint.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        },
        ctx.remaining_accounts,
        &asset.royalty_creators,
        None,
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // Close seller ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.trade.close_taker_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.taker_ta.to_account_info(),
    ))?;

    ctx.accounts
        .trade
        .pay_seller_fees(asset, fees, &creator_accounts)?;

    update_pool_accounting(
        &mut ctx.accounts.trade.pool,
        pool_initial_balance,
        TakerSide::Sell,
    )?;

    //create nft receipt for trade pool
    **ctx.accounts.nft_receipt.as_mut() = NftDepositReceipt {
        bump: ctx.bumps.nft_receipt,
        mint: ctx.accounts.t22.mint.key(),
        pool: ctx.accounts.trade.pool.key(),
    };

    Ok(())
}
