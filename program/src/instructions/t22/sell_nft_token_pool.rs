//! Sell a Token22 NFT into a Token pool.
//!
//! This is separated from Trade pool since the owner will receive the NFT directly in their ATA.

use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct SellNftTokenPoolT22<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// T22 shared accounts.
    pub t22: T22Shared<'info>,

    /// The token account of the NFT for the seller's wallet.
    #[account(
        mut,
        token::mint = t22.mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = t22.mint,
        associated_token::authority = trade.owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Token 2022 program.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> SellNftTokenPoolT22<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_sell(&PoolType::Token)?;

        let asset = self.t22.validate_asset()?;

        self.trade.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Sell a Token22 NFT into a Token pool.
pub fn process_sell_nft_token_pool_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
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

    // Transfer directly to the owner.
    let creator_accounts = transfer(
        &TransferArgs {
            from: ctx.accounts.taker_ta.to_account_info(),
            to: ctx.accounts.owner_ta.to_account_info(),
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

    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        ctx.accounts.trade.owner.to_account_info(),
    )
}
