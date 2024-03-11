use anchor_lang::prelude::*;

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const DEPOSIT_RECEIPT_SIZE: usize = 8 + 1 + 32 * 3;

/// Represents NFTs deposited into our protocol.
/// Always associated to (1) NFT mint (2) NFT escrow and (3) pool (every type).
#[account]
pub struct NftDepositReceipt {
    pub bump: u8,
    pub nft_mint: Pubkey,
    pub nft_escrow: Pubkey,
}
