use anchor_lang::prelude::*;

/// Size of the `NftDepositReceipt` account, inclusive of the 8-byte discriminator.
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
