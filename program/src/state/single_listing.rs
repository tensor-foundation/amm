use anchor_lang::prelude::*;

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const SINGLE_LISTING_SIZE: usize = 8 + (32 * 2) + 8 + 1 + 64;

#[account]
pub struct SingleListing {
    pub owner: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub bump: [u8; 1],
    pub _reserved: [u8; 64],
}
