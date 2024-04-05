use anchor_lang::prelude::*;

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const DEPOSIT_RECEIPT_SIZE: usize = 8 + 1 + 32 * 3;

/// Represents NFTs deposited into a Trade or NFT pool.
/// Seeds: "nft_receipt", mint, pool
#[account]
pub struct NftDepositReceipt {
    pub bump: u8,
    pub mint: Pubkey,
    pub pool: Pubkey,
}
