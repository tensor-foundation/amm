//! Buy a Metaplex core asset from a NFT or Trade pool.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftCore<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            core.asset.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> BuyNftCore<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_buy()?;

        self.core.validate_asset()
    }
}

/// Buy a Metaplex Core asset from a NFT or Trade pool.
pub fn process_buy_nft_core<'info>(
    ctx: Context<'_, '_, '_, 'info, BuyNftCore<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    let taker = ctx.accounts.trade.taker.to_account_info();
    let pool = ctx.accounts.trade.pool.to_account_info();
    let owner = ctx.accounts.trade.owner.to_account_info();

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        max_amount,
        TakerSide::Buy,
        Some(100), // royalties enforced
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        ctx.accounts.trade.pool.pool_id.as_ref(),
        &[ctx.accounts.trade.pool.bump[0]],
    ]];

    // Transfer the asset from the pool to the buyer.
    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&pool))
        .new_owner(&taker)
        .payer(&taker)
        .collection(ctx.accounts.core.collection.as_ref().map(|c| c.as_ref()))
        .invoke_signed(signer_seeds)?;

    ctx.accounts
        .trade
        .pay_buyer_fees(asset, fees, ctx.remaining_accounts)?;

    // Close the NFT receipt account.
    close_account(
        &mut ctx.accounts.nft_receipt.to_account_info(),
        &mut ctx.accounts.trade.owner.to_account_info(),
    )?;

    update_pool_accounting(
        &mut ctx.accounts.trade.pool,
        pool_initial_balance,
        TakerSide::Buy,
    )?;

    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        owner,
    )
}
