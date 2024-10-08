//! Sell a Metaplex legacy or pNFT into a one-sided ("Token") pool where the NFT is temporarily escrowed before
//! being transferred to the pool owner--the buyer.
//!
//! The seller is the NFT owner and receives the pool's current price, minus fees, in return.
//! This is separated from Trade pool since the owner will receive the NFT directly in their ATA.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTokenPool<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// The token account of the NFT for the seller's wallet.
    #[account(
        mut,
        token::mint = mplx.mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the owner, where the NFT will be transferred to as a result of this sale.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mplx.mint,
        associated_token::authority = trade.owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT token is temporarily escrowed as a result of this sale.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mplx.mint,
        associated_token::authority = trade.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Token Metadata owner/buyer token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: Option<UncheckedAccount<'info>>,

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

impl<'info> SellNftTokenPool<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.trade.validate_sell(&PoolType::Token)?;

        let asset = self.mplx.validate_asset()?;

        self.trade.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Sell a Metaplex legacy NFT or pNFT into a Token pool.
pub fn process_sell_nft_token_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPool<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    // Runs pre-checks and validates the asset.
    let asset = ctx.accounts.pre_process_checks()?;

    let owner = ctx.accounts.trade.owner.to_account_info();

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
    let owner_pubkey = ctx.accounts.trade.owner.key();

    // --------------------------------------- send pnft

    // Transfer NFT to owner (ATA) via pool ATA to get around pNFT restrictions.
    // has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`

    let seller = &ctx.accounts.trade.taker.to_account_info();
    let destination = &ctx.accounts.trade.pool.to_account_info();

    let transfer_args = Box::new(TransferArgs {
        payer: seller,
        source: seller,
        source_ata: &ctx.accounts.taker_ta,
        destination,
        destination_ata: &ctx.accounts.pool_ta, //<- send to pool as escrow first
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
    });

    //STEP 1/2: SEND TO ESCROW
    msg!("Sending NFT to pool escrow");
    transfer(*transfer_args, None)?;

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        ctx.accounts.trade.pool.pool_id.as_ref(),
        &[ctx.accounts.trade.pool.bump[0]],
    ]];

    //STEP 2/2: SEND FROM ESCROW
    msg!("Sending NFT from pool escrow to owner");
    transfer(
        TransferArgs {
            payer: &ctx.accounts.trade.taker.to_account_info(),
            source: &ctx.accounts.trade.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ta,
            destination: &ctx.accounts.trade.owner.to_account_info(),
            destination_ata: &ctx.accounts.owner_ta,
            mint: &ctx.accounts.mplx.mint,
            metadata: &ctx.accounts.mplx.metadata,
            edition: &ctx.accounts.mplx.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.mplx.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.mplx.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.mplx.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.owner_token_record.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so this needs to come before
    // manual lamport transfers.

    // close temp pool ata account, so it's not dangling
    token_interface::close_account(
        ctx.accounts
            .trade
            .close_pool_ata_ctx(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pool_ta.to_account_info(),
            )
            .with_signer(signer_seeds),
    )?;

    // Close seller ATA to return rent to seller.
    token_interface::close_account(ctx.accounts.trade.close_taker_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.taker_ta.to_account_info(),
    ))?;
    // --------------------------------------- end pnft

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
        owner,
    )
}
