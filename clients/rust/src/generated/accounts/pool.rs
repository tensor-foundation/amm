//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::PoolConfig;
use crate::generated::types::PoolStats;
use crate::hooked::Currency;
use crate::hooked::NullableAddress;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

/// Pool is the main state account in the AMM program and represents the AMM pool where trades can happen.
/// `Pool` accounts are Program Derived Addresses derived  from the seeds: `"pool"`, `owner`, and `identifier`.

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Pool {
    pub discriminator: [u8; 8],
    /// Pool version, used to control upgrades.
    pub version: u8,
    /// Bump seed for the pool PDA.
    pub bump: [u8; 1],
    /// Owner-chosen identifier for the pool
    pub pool_id: [u8; 32],
    /// Unix timestamp of the pool creation, in seconds.
    pub created_at: i64,
    /// Unix timestamp of the last time the pool has been updated, in seconds.
    pub updated_at: i64,
    /// Unix timestamp of when the pool expires, in seconds.
    pub expiry: i64,
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
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub rent_payer: Pubkey,
    pub currency: Currency,
    /// The amount of currency held in the pool.
    pub amount: u64,
    /// The difference between the number of buys and sells
    /// where a postive number indicates the taker has BOUGHT more NFTs than sold
    /// and a negative number indicates the taker has SOLD more NFTs than bought.
    /// This is used to calculate the current price of the pool.
    pub price_offset: i32,
    /// The number of NFTs currently held in the pool.
    pub nfts_held: u32,
    /// Various stats about the pool, including the number of buys and sells.
    pub stats: PoolStats,
    /// If an escrow account is present, it means it's a shared-escrow pool where liquidity is shared with other pools.
    pub shared_escrow: NullableAddress,
    /// An offchain actor that signs off to make sure an offchain condition is met (eg trait present).
    pub cosigner: NullableAddress,
    /// Maker broker fees will be sent to this address if populated.
    pub maker_broker: NullableAddress,
    /// Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinity.
    pub max_taker_sell_count: u32,
    /// Pool configuration values.
    pub config: PoolConfig,
    /// Reserved space for future upgrades.
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
    ///   2. pool_id (`[u8; 32]`)
    pub const PREFIX: &'static [u8] = "pool".as_bytes();

    pub fn create_pda(
        owner: Pubkey,
        pool_id: [u8; 32],
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &["pool".as_bytes(), owner.as_ref(), &pool_id, &[bump]],
            &crate::AMM_ID,
        )
    }

    pub fn find_pda(owner: &Pubkey, pool_id: [u8; 32]) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &["pool".as_bytes(), owner.as_ref(), &pool_id],
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
