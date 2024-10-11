//! Sell a Metaplex legacy or pNFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
//! owner of the NFT.
//!
//! The seller is the owner of the NFT and receives the pool's current price in return.
//! This is separated from Token pool since the asset will be transferred to the pool and
//! a deposit receipt is created for it.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTradePool<'info> {
    // Trade shared accounts
    pub trade: TradeShared<'info>,

    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = trade.taker,
        seeds=[
            b"nft_receipt".as_ref(),
            mplx.mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump,
        space = NftDepositReceipt::SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The token account of the seller, where the NFT will be transferred from.
    #[account(
        mut,
        token::mint = mplx.mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be transferred to.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mplx.mint,
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
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_sell(&PoolType::Trade)?;

        let asset = self.mplx.validate_asset()?;

        self.trade.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Sell a Metaplex legacy NFT or pNFT into a Trade pool.
pub fn process_sell_nft_trade_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        min_price,
        TakerSide::Sell,
        if asset.royalty_enforced {
            Some(100)
        } else {
            optional_royalty_pct
        },
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();

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
            destination_ata: &ctx.accounts.pool_ta,
            mint: &ctx.accounts.mplx.mint,
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
        mint: ctx.accounts.mplx.mint.key(),
        pool: ctx.accounts.trade.pool.key(),
    };

    Ok(())
}
