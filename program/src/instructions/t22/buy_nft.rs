//! Buy a Token22 NFT from a NFT or Trade pool.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftT22<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// T22 shared accounts.
    pub t22: T22Shared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            t22.mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The TA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = t22.mint,
        associated_token::authority = trade.taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT will be escrowed.
    #[account(
        mut,
        associated_token::mint = t22.mint,
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
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_buy()?;

        self.t22.validate_asset()
    }
}

/// Buy a Token22 NFT from a NFT or Trade pool.
pub fn process_buy_nft_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, BuyNftT22<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        max_amount,
        TakerSide::Buy,
        Some(100), // no optional royalties for now
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        ctx.accounts.trade.pool.pool_id.as_ref(),
        &[ctx.accounts.trade.pool.bump[0]],
    ]];

    // Transfer from the pool to the buyer.
    let creator_accounts = transfer(
        &TransferArgs {
            from: ctx.accounts.pool_ta.to_account_info(),
            to: ctx.accounts.taker_ta.to_account_info(),
            authority: ctx.accounts.trade.pool.to_account_info(),
            mint: ctx.accounts.t22.mint.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        },
        ctx.remaining_accounts,
        &asset.royalty_creators,
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

    ctx.accounts
        .trade
        .pay_buyer_fees(asset, fees, &creator_accounts)?;

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
        ctx.accounts.trade.owner.to_account_info(),
    )
}
