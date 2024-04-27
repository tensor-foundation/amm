use std::ops::Deref;

use anchor_lang::prelude::*;
use mpl_token_metadata::accounts::Metadata;
use spl_math::precise_number::PreciseNumber;
use tensor_toolbox::{calc_creators_fee, NullableOption};
use vipers::{throw_err, unwrap_checked, unwrap_int};

use crate::{constants::*, error::ErrorCode};

// (!) INCLUSIVE of discriminator (8 bytes)
#[constant]
#[allow(clippy::identity_op)]
pub const POOL_SIZE: usize = 8 + (2 * 1) // version + bump
        + 32                             // identifier
        + 8 * 3                          // created_at, updated_at, expiry
        + (2 * 1) + (2 * 8) + 1 + 3      // pool config
        + (3 * 32)                       // owner, whitelist, rent_payer
        + (32 + 8)                       // currency and currency amount
        + (3 * 4)                        // taker_sell_count, taker_buy_count, nfts_held
        + (2 * 4) + 8                    // pool stats
        + (2 * 32)                       // shared escrow, cosigner
        + 4                              // max_taker_sell_count
        + 100                            // _reserved
        ;

/// Amount of SOL required to keep the pool account alive. Min "rent".
// Sync this with any changes to the Pool size.
#[constant]
pub const POOL_STATE_BOND: u64 = 3814080;

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
    pub starting_price: u64,
    pub delta: u64,
    pub mm_compound_fees: bool,
    pub mm_fee_bps: NullableOption<u16>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, Default)]
pub struct PoolStats {
    pub taker_sell_count: u32,
    pub taker_buy_count: u32,
    pub accumulated_mm_profit: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, Eq, PartialEq, Hash)]
pub struct Currency(Pubkey);

impl Deref for Currency {
    type Target = Pubkey;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Currency {
    pub fn new(pubkey: Pubkey) -> Self {
        Self(pubkey)
    }

    pub fn sol() -> Self {
        Self::default()
    }

    pub fn is_sol(&self) -> bool {
        *self == Self::default()
    }
}

#[account]
pub struct Pool {
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

    pub owner: Pubkey,
    pub whitelist: Pubkey,
    // Store the rent payer, if different from the owner so they can be refunded
    // without signing when the pool is closed.
    pub rent_payer: Pubkey,
    // Default Pubkey is SOL, otherwise SPL token mint
    pub currency: Currency,
    /// The amount of currency held in the pool
    pub amount: u64,

    /// The difference between the number of buys and sells
    /// where a postive number indicates the taker has BOUGHT more NFTs than sold
    /// and a negative number indicates the taker has SOLD more NFTs than bought.
    /// This is used to calculate the current price of the pool.
    pub price_offset: i32,
    pub nfts_held: u32,

    pub stats: PoolStats,

    /// If an escrow account is present, means it's a shared-escrow pool
    pub shared_escrow: NullableOption<Pubkey>,
    /// Offchain actor signs off to make sure an offchain condition is met (eg trait present)
    pub cosigner: NullableOption<Pubkey>,
    /// Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinitya
    pub max_taker_sell_count: u32,

    pub config: PoolConfig,

    // (!) make sure aligns with last number in SIZE
    pub _reserved: [u8; 100],
}

pub fn calc_tswap_fee(fee_bps: u16, current_price: u64) -> Result<u64> {
    let fee = unwrap_checked!({
        (fee_bps as u64)
            .checked_mul(current_price)?
            .checked_div(HUNDRED_PCT_BPS as u64)
    });

    Ok(fee)
}

impl Pool {
    pub fn taker_allowed_to_sell(&self) -> Result<()> {
        //0 indicates no restriction on buy count / if no shared_escrow, not relevant
        if self.max_taker_sell_count == 0 || self.shared_escrow.value().is_none() {
            return Ok(());
        }

        //if the pool has made more sells than buys, by defn it can buy more to get to initial state
        if self.stats.taker_buy_count > self.stats.taker_sell_count {
            return Ok(());
        }

        //<= because equal means taker can no longer sell
        if self.max_taker_sell_count <= self.stats.taker_sell_count - self.stats.taker_buy_count {
            throw_err!(ErrorCode::MaxTakerSellCountExceeded);
        }
        Ok(())
    }

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

    pub fn calc_mm_fee(&self, current_price: u64) -> Result<u64> {
        if self.config.pool_type != PoolType::Trade {
            throw_err!(ErrorCode::WrongPoolType);
        }

        let fee = unwrap_checked!({
            // NB: unrwap_or(0) since we had a bug where we allowed someone to edit a trade pool to have null mm_fees.
            (*self.config.mm_fee_bps.value().unwrap_or(&0) as u64)
                .checked_mul(current_price)?
                .checked_div(HUNDRED_PCT_BPS as u64)
        });

        Ok(fee)
    }

    pub fn calc_tswap_fee(&self, current_price: u64) -> Result<u64> {
        calc_tswap_fee(TAKER_FEE_BPS, current_price)
    }

    pub fn current_price(&self, side: TakerSide) -> Result<u64> {
        match (self.config.pool_type, side) {
            (PoolType::Trade, TakerSide::Buy)
            | (PoolType::Token, TakerSide::Sell)
            | (PoolType::NFT, TakerSide::Buy) => self.shift_price(self.price_offset),

            // Trade pool sells require the price to be shifted down by 1 to prevent
            // liquidity from being drained by repeated matched buys and sells.
            (PoolType::Trade, TakerSide::Sell) => self.shift_price(self.price_offset - 1),

            // Invalid combinations of pool type and side.
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
    }

    pub fn calc_creators_fee(
        &self,
        metadata: &Metadata,
        current_price: u64,
        optional_royalty_pct: Option<u16>,
    ) -> Result<u64> {
        calc_creators_fee(
            metadata.seller_fee_basis_points,
            current_price,
            metadata.token_standard,
            optional_royalty_pct,
        )
    }

    pub fn shift_price(&self, price_offset: i32) -> Result<u64> {
        let direction = if price_offset > 0 {
            Direction::Up
        } else {
            Direction::Down
        };

        let offset = price_offset.unsigned_abs();

        let current_price = match self.config.curve_type {
            CurveType::Linear => {
                let base = self.config.starting_price;
                let delta = self.config.delta;

                match direction {
                    Direction::Up => {
                        unwrap_checked!({ base.checked_add(delta.checked_mul(offset as u64)?) })
                    }
                    Direction::Down => {
                        unwrap_checked!({ base.checked_sub(delta.checked_mul(offset as u64)?) })
                    }
                }
            }
            CurveType::Exponential => {
                let hundred_pct = unwrap_int!(PreciseNumber::new(HUNDRED_PCT_BPS.into()));

                let base = unwrap_int!(PreciseNumber::new(self.config.starting_price.into()));
                let factor = unwrap_checked!({
                    PreciseNumber::new(
                        (HUNDRED_PCT_BPS as u64)
                            .checked_add(self.config.delta)?
                            .into(),
                    )?
                    .checked_div(&hundred_pct)?
                    .checked_pow(offset.into())
                });

                let result = match direction {
                    // price * (1 + delta)^trade_count
                    Direction::Up => base.checked_mul(&factor),
                    //same but / instead of *
                    Direction::Down => base.checked_div(&factor),
                };

                unwrap_int!(u64::try_from(unwrap_checked!({ result?.to_imprecise() })).ok())
            }
        };

        Ok(current_price)
    }

    /// This check is against the following scenario:
    /// 1. user sets cap to 1 and reaches it (so 1/1)
    /// 2. user detaches shared escrow
    /// 3. user sells more into the pool (so 2/1)
    /// 4. user attaches shared escrow again, but 2/1 is theoretically invalid
    pub fn adjust_pool_max_taker_sell_count(&mut self) -> Result<()> {
        if self
            .valid_max_sell_count(self.max_taker_sell_count)
            .is_err()
        {
            self.max_taker_sell_count = self.stats.taker_sell_count - self.stats.taker_buy_count;
        }

        Ok(())
    }

    pub fn seeds(&self) -> [&[u8]; 4] {
        [
            b"pool",
            self.owner.as_ref(),
            self.pool_id.as_ref(),
            &self.bump,
        ]
    }
}

pub enum Direction {
    Up,
    Down,
}

#[derive(PartialEq, Eq)]
pub enum TakerSide {
    Buy,  // Buying from the pool.
    Sell, // Selling into the pool.
}
