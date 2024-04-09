//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::PoolConfig;
use crate::generated::types::PoolStats;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Pool {
    pub discriminator: [u8; 8],
    /// Pool version, used to control upgrades.
    pub version: u8,
    /// Bump seed for the pool PDA.
    pub bump: [u8; 1],
    /// Owner-chosen identifier for the pool
    pub identifier: [u8; 32],
    /// Unix timestamp of the pool creation, in seconds.
    pub created_at: i64,
    /// Unix timestamp of the last time the pool has been updated, in seconds.
    pub updated_at: i64,
    /// Unix timestamp of when the pool expires, in seconds.
    pub expires_at: i64,
    pub config: PoolConfig,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub owner: Pubkey,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub whitelist: Pubkey,
    pub rent_payer: Option<Pubkey>,
    pub currency: Option<Pubkey>,
    /// How many times a taker has SOLD into the pool
    pub taker_sell_count: u32,
    /// How many times a taker has BOUGHT from the pool
    pub taker_buy_count: u32,
    pub nfts_held: u32,
    pub stats: PoolStats,
    /// If an escrow account is present, means it's a shared-escrow pool
    pub shared_escrow: Option<Pubkey>,
    /// Offchain actor signs off to make sure an offchain condition is met (eg trait present)
    pub cosigner: Option<Pubkey>,
    /// Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinitya
    pub max_taker_sell_count: u32,
    #[cfg_attr(feature = "serde", serde(with = "serde_with::As::<serde_with::Bytes>"))]
    pub reserved: [u8; 100],
}

impl Pool {
    /// Prefix values used to generate a PDA for this account.
    ///
    /// Values are positional and appear in the following order:
    ///
    ///   0. `Pool::PREFIX`
    ///   1. owner (`Pubkey`)
    ///   2. identifier (`[u8; 32]`)
    pub const PREFIX: &'static [u8] = "pool".as_bytes();

    pub fn create_pda(
        owner: Pubkey,
        identifier: [u8; 32],
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &["pool".as_bytes(), owner.as_ref(), &identifier, &[bump]],
            &crate::AMM_ID,
        )
    }

    pub fn find_pda(owner: &Pubkey, identifier: [u8; 32]) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &["pool".as_bytes(), owner.as_ref(), &identifier],
            &crate::AMM_ID,
        )
    }

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for Pool {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}
