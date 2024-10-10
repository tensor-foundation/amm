//! Withdraw a Metaplex legacy NFT or pNFT from a NFT or Trade pool.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct WithdrawNft<'info> {
    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mplx.mint.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The TA of the owner, where the NFT will be transferred to as a result of this action.
    #[account(
        init_if_needed,
        payer = transfer.owner,
        associated_token::mint = mplx.mint,
        associated_token::authority = transfer.owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT token is escrowed.
    #[account(
        mut,
        associated_token::mint = mplx.mint,
        associated_token::authority = transfer.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Interface<'info, TokenInterface>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawNft<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.mplx.validate_asset()
    }
}

/// Withdraw a Metaplex legacy NFT or pNFT from a NFT or Trade pool.
pub fn process_withdraw_nft<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNft<'info>>,
    authorization_data: Option<AuthorizationDataLocal>,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    let pool = &ctx.accounts.transfer.pool;
    let owner_pubkey = ctx.accounts.transfer.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    transfer(
        TransferArgs {
            payer: &ctx.accounts.transfer.owner.to_account_info(),
            source: &ctx.accounts.transfer.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ta,
            destination: &ctx.accounts.transfer.owner,
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
            destination_token_record: ctx.accounts.mplx.user_token_record.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // close pool ATA
    token_interface::close_account(
        ctx.accounts
            .transfer
            .close_pool_ata_ctx(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.pool_ta.to_account_info(),
            )
            .with_signer(signer_seeds),
    )?;

    //update pool
    let pool = &mut ctx.accounts.transfer.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Close the NFT receipt account.
    close_account(
        &mut ctx.accounts.nft_receipt.to_account_info(),
        &mut ctx.accounts.transfer.owner.to_account_info(),
    )
}
