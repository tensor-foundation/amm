use anchor_lang::prelude::*;

use crate::constants::DISCRIMINATOR_SIZE;

/// Represents NFTs deposited into a Trade or NFT pool.
/// Seeds: "nft_receipt", mint, pool
#[account]
#[derive(Default, Debug, InitSpace, Eq, PartialEq)]
pub struct NftDepositReceipt {
    pub bump: u8,
    pub mint: Pubkey,
    pub pool: Pubkey,
}

impl NftDepositReceipt {
    /// Size of the `NftDepositReceipt` account, inclusive of the 8-byte discriminator.
    pub const SIZE: usize = DISCRIMINATOR_SIZE + Self::INIT_SPACE;
}
