//! Sell a Metaplex Core asset into a Token pool.
//!
//! This is separated from Trade pool since the owner will receive the asset directly.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTokenPoolCore<'info> {
    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> SellNftTokenPoolCore<'info> {
    pub fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_sell(&PoolType::Token)?;
        self.trade.verify_whitelist(&self.core, None)
    }
}

/// Sell a MPL Core NFT into a Token pool.
pub fn process_sell_nft_token_pool_core<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolCore<'info>>,
    min_price: u64,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    let taker = ctx.accounts.trade.taker.to_account_info();
    let owner = ctx.accounts.trade.owner.to_account_info();

    let asset = ctx.accounts.core.validate_asset(None)?;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        min_price,
        TakerSide::Sell,
        Some(100),
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();

    // Transfer the asset from the seller directly to the pool owner.
    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&taker))
        .new_owner(&owner)
        .payer(&taker)
        .collection(ctx.accounts.core.collection.as_ref().map(|c| c.as_ref()))
        .invoke()?;

    ctx.accounts
        .trade
        .pay_seller_fees(asset, fees, ctx.remaining_accounts)?;

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
