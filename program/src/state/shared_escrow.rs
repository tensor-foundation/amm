use anchor_lang::prelude::*;

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const SHARED_ESCROW_SIZE: usize = 8 + 32 + 32 + 2 + 1 + 4 + 64;

// TODO: if size ever changes, be sure to update APPROX_SOL_MARGIN_RENT in tensor-infra
// seeds: 
#[account]
pub struct SharedEscrow {
    pub owner: Pubkey,
    pub name: [u8; 32],
    pub nr: u16,
    pub bump: [u8; 1],
    //needed to know if we can close margin account
    pub pools_attached: u32,
    // TODO: we forgot to track bids attached.
    // Revisit this maybe for margin account V2.
    //(!) this is important - otherwise rent will be miscalculated by anchor client-side
    pub _reserved: [u8; 64],
}
