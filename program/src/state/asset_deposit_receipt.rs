use anchor_lang::prelude::*;

/// Represents Assets deposited into a Trade or NFT pool.
/// Seeds: "nft_receipt", asset, pool
/// Dummy struct to allow Kinobi to generate the PDA seeds.
/// This is the deposit receipt for NFT standards that have "asset" addresses instead of "mint" addresses.
#[account]
pub struct AssetDepositReceipt {
    pub bump: u8,
    pub asset: Pubkey,
    pub pool: Pubkey,
}
