use anchor_spl::token_interface::Mint;

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct EditSingleListing<'info> {
    #[account(mut,
        seeds=[
            b"single_listing".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump = single_listing.bump[0],
        has_one = nft_mint,
        has_one = owner,
    )]
    pub single_listing: Box<Account<'info, SingleListing>>,

    #[account(
        constraint = nft_mint.key() == single_listing.nft_mint @ ErrorCode::WrongMint,
    )]
    pub nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: has_one = owner in single_listing
    #[account()]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_edit_single_listing<'info>(
    ctx: Context<'_, '_, '_, 'info, EditSingleListing<'info>>,
    price: u64,
) -> Result<()> {
    let single_listing = &mut ctx.accounts.single_listing;
    single_listing.price = price;

    Ok(())
}
