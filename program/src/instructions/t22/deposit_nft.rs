//! Deposit a Token22 NFT into a NFT or Trade pool.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct DepositNftT22<'info> {
    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// T22 shared accounts.
    pub t22: T22Shared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = transfer.owner,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ta and pool_ta.
    #[account(
        constraint = mint.key() == owner_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The TA of the owner, where the NFT will be transferred from.
    #[account(
        mut,
        token::mint = mint,
        token::authority = transfer.owner,
        token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT will be escrowed.
    #[account(
        init_if_needed,
        payer = transfer.owner,
        associated_token::mint = mint,
        associated_token::authority = transfer.pool,
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

impl<'info> DepositNftT22<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.transfer.validate()?;

        let asset = self.t22.validate_asset(Some(self.mint.to_account_info()))?;

        self.transfer.verify_whitelist(&asset)?;

        Ok(asset)
    }
}

/// Deposit a Token22 NFT into a NFT or Trade pool.
pub fn process_deposit_nft_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositNftT22<'info>>,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    let remaining_accounts = ctx.remaining_accounts.to_vec();

    // validate mint account
    let royalties = validate_mint(&ctx.accounts.mint.to_account_info())?;

    // transfer the NFT
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.owner_ta.to_account_info(),
            to: ctx.accounts.pool_ta.to_account_info(),
            authority: ctx.accounts.transfer.owner.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    // this will only add the remaining accounts required by a transfer hook if we
    // recognize the hook as a royalty one
    if royalties.is_some() {
        transfer_cpi = transfer_cpi.with_remaining_accounts(remaining_accounts);
    }

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    // Close owner ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.transfer.close_owner_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.owner_ta.to_account_info(),
    ))?;

    //update pool
    let pool = &mut ctx.accounts.transfer.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.mint = ctx.accounts.mint.key();
    receipt.pool = ctx.accounts.transfer.pool.key();

    Ok(())
}
