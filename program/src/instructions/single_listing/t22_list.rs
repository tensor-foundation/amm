use anchor_spl::token_interface::{
    transfer_checked, Mint, Token2022, TokenAccount, TransferChecked,
};
use tensor_toolbox::token_2022::{
    t22_validate_mint,
    token::{safe_initialize_token_account, InitializeTokenAccount},
};

use crate::*;

#[derive(Accounts)]
pub struct ListT22<'info> {
    #[account(
        init, //<-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = payer,
        seeds=[
            b"single_listing".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
        space = SINGLE_LISTING_SIZE,
    )]
    pub single_listing: Box<Account<'info, SingleListing>>,

    #[account(mut, token::mint = nft_mint, token::authority = owner)]
    pub nft_source: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: seed in nft_escrow & nft_receipt
    pub nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: seeds checked so must be Tamm PDA
    #[account(mut,
    seeds = [
        b"nft_owner",
        nft_mint.key().as_ref(),
        ],
        bump
    )]
    pub nft_escrow_owner: AccountInfo<'info>,

    /// CHECK: initialized on instruction; implicitly checked via transfer (will fail if wrong account)
    #[account(mut,
        seeds = [
            b"nft_escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
    )]
    pub nft_escrow_token: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: the token transfer will fail if owner is wrong (signature error)
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,

    //separate payer so that a program can list with owner being a PDA
    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn process_list_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, ListT22<'info>>,
    price: u64,
) -> Result<()> {
    // validate mint account

    t22_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

    // initialize escrow token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.nft_escrow_token.to_account_info(),
            mint: &ctx.accounts.nft_mint.to_account_info(),
            authority: &ctx.accounts.nft_escrow_owner.to_account_info(),
            payer: &ctx.accounts.payer,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            signer_seeds: &[
                b"nft_escrow".as_ref(),
                ctx.accounts.nft_mint.key().as_ref(),
                &[ctx.bumps.nft_escrow_token],
            ],
        },
        false, //<-- this HAS to be false for safety (else single listings and pool listings can get mixed)
    )?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.nft_source.to_account_info(),
            to: ctx.accounts.nft_escrow_token.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
        },
    );

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    //record listing state
    let listing = &mut ctx.accounts.single_listing;
    listing.owner = ctx.accounts.owner.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.price = price;
    listing.bump = [ctx.bumps.single_listing];

    Ok(())
}
