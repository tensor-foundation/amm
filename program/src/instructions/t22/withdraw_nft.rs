//! Withdraw a Token22 NFT from a NFT or Trade pool.

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct WithdrawNftT22<'info> {
    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// T22 shared accounts.
    pub t22: T22Shared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            t22.mint.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The TA of the owner where the NFT will be withdrawn to.
    #[account(
        init_if_needed,
        payer = transfer.owner,
        associated_token::mint = t22.mint,
        associated_token::authority = transfer.owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT token is escrowed.
    #[account(
        mut,
        associated_token::mint = t22.mint,
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

impl<'info> WithdrawNftT22<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.t22.validate_asset()
    }
}

/// Withdraw a Token22 NFT from a NFT or Trade pool.
pub fn process_withdraw_nft_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNftT22<'info>>,
) -> Result<()> {
    let asset = ctx.accounts.pre_process_checks()?;

    // transfer the NFT
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.pool_ta.to_account_info(),
            to: ctx.accounts.owner_ta.to_account_info(),
            authority: ctx.accounts.transfer.pool.to_account_info(),
            mint: ctx.accounts.t22.mint.to_account_info(),
        },
    );

    // this will only add the remaining accounts required by a transfer hook if we
    // recognize the hook as a royalty one
    if asset.royalty_creators.is_some() {
        transfer_cpi = transfer_cpi.with_remaining_accounts(ctx.remaining_accounts.to_vec());
    }

    let pool = &ctx.accounts.transfer.pool;
    let owner_pubkey = ctx.accounts.transfer.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
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
    )?;

    Ok(())
}
