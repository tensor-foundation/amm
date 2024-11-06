//! Sell a Metaplex Core asset into a two-sided ("Trade") pool, where the pool
//! is the buyer and ends up as the owner of the asset.
//!
//! The seller is the owner of the asset and receives the pool's current price in return.
//! This is separated from Token pool since the asset will be transferred to the pool and
//! a deposit receipt is created for it.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTradePoolCore<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
            init,
            payer = trade.taker,
            seeds=[
                b"nft_receipt".as_ref(),
                core.asset.key().as_ref(),
                trade.pool.key().as_ref(),
            ],
            bump,
            space = NftDepositReceipt::SIZE,
        )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> SellNftTradePoolCore<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_sell(&PoolType::Trade)?;

        let asset = self.core.validate_asset()?;

        self.trade.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Sell a MPL Core asset into a Trade pool.
pub fn process_sell_nft_trade_pool_core<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePoolCore<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    let taker = ctx.accounts.trade.taker.to_account_info();
    let pool = &ctx.accounts.trade.pool;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        min_price,
        TakerSide::Sell,
        Some(100),
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();

    // Transfer the NFT from the seller to the pool.
    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&taker))
        .new_owner(&pool.to_account_info())
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

    //create nft receipt for trade pool
    **ctx.accounts.nft_receipt.as_mut() = NftDepositReceipt {
        bump: ctx.bumps.nft_receipt,
        mint: ctx.accounts.core.asset.key(),
        pool: ctx.accounts.trade.pool.key(),
    };

    Ok(())
}
