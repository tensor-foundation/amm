use anchor_lang::prelude::*;
use vipers::throw_err;

use crate::error::ErrorCode;

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const POOL_SIZE: usize = 8 + (3 * 1)
        + 32 // identifier
        + 8  // created_at
        + 8  // updated_at
        + (2 * 1) + (2 * 8) + 1 + 3 //pool config
        + (3 * 32) // owner, whitelist, sol_escrow
        + (3 * 4)  // taker_sell_count, taker_buy_count, nfts_held
        + (2 * 4) + 8 //pool stats
        + 32 + 1   // shared escrow Option
        + 32 + 1   // cosigner Option
        + 4; // max_taker_sell_count

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoolType {
    Token = 0, //buys NFTs
    NFT = 1,   //sells NFTs
    Trade = 2, //both buys & sells
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CurveType {
    Linear = 0,
    Exponential = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy)]
pub struct PoolConfig {
    pub pool_type: PoolType,
    pub curve_type: CurveType,
    pub starting_price: u64, //lamports
    pub delta: u64,          //lamports pr bps
    /// Trade pools only
    pub mm_compound_fees: bool,
    pub mm_fee_bps: Option<u16>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, Default)]
pub struct PoolStats {
    pub taker_sell_count: u32,
    pub taker_buy_count: u32,
    pub accumulated_mm_profit: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, Default)]
pub struct Frozen {
    pub amount: u64,
    pub time: i64,
}

#[account]
pub struct Pool {
    /// Pool version, used to control upgrades.
    pub version: u8,
    /// Bump seed for the pool PDA.
    pub bump: [u8; 1],
    /// SOL Escrow PDA bump seed.
    pub sol_escrow_bump: [u8; 1],
    /// Owner-chosen identifier for the pool
    pub identifier: [u8; 32],

    /// Unix timestamp of the pool creation, in seconds.
    pub created_at: i64,
    /// Last time a buy or sell order has been executed
    pub updated_at: i64,

    pub config: PoolConfig,
    pub owner: Pubkey,
    pub whitelist: Pubkey,
    pub sol_escrow: Pubkey,

    /// How many times a taker has SOLD into the pool
    pub taker_sell_count: u32,
    /// How many times a taker has BOUGHT from the pool
    pub taker_buy_count: u32,
    pub nfts_held: u32,

    pub stats: PoolStats,

    /// If an escrow account present, means it's a shared-escrow pool (currently bids only)
    pub shared_escrow: Option<Pubkey>,
    /// Offchain actor signs off to make sure an offchain condition is met (eg trait present)
    pub cosigner: Option<Pubkey>,
    /// Limit how many buys a pool can execute - useful for cross-margin, else keeps buying into infinity
    // Ideally would use an option here, but not enough space w/o migrating pools, hence 0 = no restriction
    pub max_taker_sell_count: u32,
    // (!) make sure aligns with last number in SIZE
    // pub _reserved: [u8; 0],
}

impl Pool {
    //used when editing pools to prevent setting a new cap that's too low
    pub fn valid_max_sell_count(&self, new_count: u32) -> Result<()> {
        //0 indicates no restriction
        if new_count == 0 {
            return Ok(());
        }

        //if the pool has made more sells than buys, by defn we can set any cap (including lowest = 1)
        if self.stats.taker_buy_count > self.stats.taker_sell_count {
            return Ok(());
        }

        //< without = because we should let them edit the cap to stop sales
        if new_count < self.stats.taker_sell_count - self.stats.taker_buy_count {
            throw_err!(ErrorCode::MaxTakerSellCountTooSmall);
        }

        Ok(())
    }
}
