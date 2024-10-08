//! Buy a Metaplex legacy NFT or pNFT from a NFT or Trade pool.

use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct BuyNft<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds = [
            b"nft_receipt".as_ref(),
            mplx.mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The TA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mplx.mint,
        associated_token::authority = trade.taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT is held.
    #[account(
        mut,
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
    //
    // remaining accounts:
    // optional 0 to N creator accounts
}

impl<'info> BuyNft<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_buy()?;

        self.mplx.validate_asset()
    }
}

/// Allows a buyer to purchase a Metaplex legacy NFT or pNFT from a Trade or NFT pool.
pub fn process_buy_nft<'info>(
    ctx: Context<'_, '_, '_, 'info, BuyNft<'info>>,
    max_amount: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    // Pre-handler validation checks.
    let asset = ctx.accounts.pre_process_checks()?;

    let taker = ctx.accounts.trade.taker.to_account_info();
    let owner = ctx.accounts.trade.owner.to_account_info();

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        max_amount,
        TakerSide::Buy,
        if asset.royalty_enforced {
            Some(100)
        } else {
            optional_royalty_pct
        },
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        ctx.accounts.trade.pool.pool_id.as_ref(),
        &[ctx.accounts.trade.pool.bump[0]],
    ]];

    // Transfer nft to buyer
    // Has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    transfer(
        TransferArgs {
            payer: &taker,
            source: &ctx.accounts.trade.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ta,
            destination: &taker,
            destination_ata: &ctx.accounts.taker_ta,
            mint: &ctx.accounts.mplx.mint,
            metadata: &ctx.accounts.mplx.metadata,
            edition: &ctx.accounts.mplx.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.mplx.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.mplx.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.mplx.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.mplx.user_token_record.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
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

    // If the pool is an NFT pool, and no remaining NFTs held, we can close it.
    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        owner,
    )
}
