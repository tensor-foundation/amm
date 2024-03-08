use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use tensor_toolbox::token_2022::t22_validate_mint;

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct DelistT22<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
    )]
    pub nft_dest: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = nft_mint.key() == nft_escrow_token.mint @ ErrorCode::WrongMint,
        constraint = nft_mint.key() == single_listing.nft_mint @ ErrorCode::WrongMint,
    )]
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

    /// Implicitly checked via transfer. Will fail if wrong account
    /// This is closed below (dest = owner)
    #[account(
        mut,
        seeds=[
            b"nft_escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
        token::mint = nft_mint, token::authority = nft_escrow_owner,
    )]
    pub nft_escrow_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        seeds=[
            b"single_listing".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump = single_listing.bump[0],
        has_one = nft_mint,
        has_one = owner,
        close = payer,
    )]
    pub single_listing: Box<Account<'info, SingleListing>>,

    /// CHECK: has_one = owner in single_listing
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    //separate payer so that a program can list with owner being a PDA
    #[account(mut)]
    pub payer: Signer<'info>,
}

impl<'info> DelistT22<'info> {
    fn close_nft_escrow_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.nft_escrow_token.to_account_info(),
                destination: self.payer.to_account_info(),
                authority: self.nft_escrow_owner.to_account_info(),
            },
        )
    }
}

pub fn process_delist_t22<'info>(ctx: Context<'_, '_, '_, 'info, DelistT22<'info>>) -> Result<()> {
    // validate mint account

    t22_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.nft_escrow_token.to_account_info(),
            to: ctx.accounts.nft_dest.to_account_info(),
            authority: ctx.accounts.nft_escrow_owner.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
        },
    );

    let nft_mint_pubkey = ctx.accounts.nft_mint.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"nft_owner",
        nft_mint_pubkey.as_ref(),
        &[ctx.bumps.nft_escrow_owner],
    ]];

    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
    )?;

    // close nft escrow account

    token_interface::close_account(
        ctx.accounts
            .close_nft_escrow_ctx()
            .with_signer(signer_seeds),
    )?;

    emit!(DelistEvent {
        current_price: ctx.accounts.single_listing.price,
    });

    Ok(())
}
