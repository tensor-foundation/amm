use anchor_lang::prelude::*;
use spl_math::precise_number::PreciseNumber;
use tensor_toolbox::{transfer_lamports_checked, HUNDRED_PCT_BPS};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int};

use crate::error::ErrorCode;

/// Size of the Pool account, inclusive of the 8-byte discriminator.
#[constant]
#[allow(clippy::identity_op)]
pub const POOL_SIZE: usize =
        8                                // discriminator
        + (2 * 1)                        // version + bump
        + 32                             // identifier
        + 8 * 3                          // created_at, updated_at, expiry
        + (3 * 32)                       // owner, whitelist, rent_payer
        + (32 + 8)                       // currency and currency amount
        + (2 * 4)                        // price_offset, nfts_held
        + (2 * 4) + 8                    // pool stats
        + (3 * 32)                       // shared escrow, cosigner, maker_broker
        + 4                              // max_taker_sell_count
        + (2 * 1) + (2 * 8) + 1 + 2      // pool config
        + 100                            // _reserved
        ;

/// Enum representing the different types of pools.
///
/// Token pools are single-sided pools that hold SOL and NFTs can be sold into them.
///
/// NFT pools are single-sided pools that hold NFTs and NFTs can be purchased from them.
///
/// Trade pools are double-sided pools that hold SOL and NFTs and can be used to trade between the two.
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoolType {
    Token = 0,
    NFT = 1,
    Trade = 2,
}

/// Enum representing the different types of curves that can be used in a pool.
///
/// Linear curves have price offsets that increase or decrease linearly.
///
/// Exponential curves have a price offset that increases or decreases exponentially.
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CurveType {
    Linear = 0,
    Exponential = 1,
}

/// Configuration values for a pool define the type of pool, curve, and other parameters.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct PoolConfig {
    pub pool_type: PoolType,
    pub curve_type: CurveType,
    pub starting_price: u64,
    pub delta: u64,
    pub mm_compound_fees: bool,
    pub mm_fee_bps: u16,
}

/// Stats for a pool include the number of buys and sells, and the accumulated MM profit.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PoolStats {
    pub taker_sell_count: u32,
    pub taker_buy_count: u32,
    pub accumulated_mm_profit: u64,
}

/// `Pool` is the main state account in the AMM program and represents the AMM pool where trades can happen.
/// `Pool` accounts are Program Derived Addresses derived  from the seeds: `"pool"`, `owner`, and `identifier`.
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

    /// The owner of the pool.
    pub owner: Pubkey,
    /// The whitelist of the pool, determining which NFTs can be deposited or sold into the pool.
    pub whitelist: Pubkey,
    // Store the rent payer, if different from the owner so they can be refunded
    // without signing when the pool is closed.
    pub rent_payer: Pubkey,

    // Default Pubkey is SOL, otherwise SPL token mint.
    pub currency: Pubkey,
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
    /// Default pubkey is interpreted as no value.
    pub shared_escrow: Pubkey,
    /// An offchain actor that signs off to make sure an offchain condition is met (eg trait present).
    /// Default pubkey is interpreted as no value.
    pub cosigner: Pubkey,
    /// Maker broker fees will be sent to this address if populated.
    /// Default pubkey is interpreted as no value.
    pub maker_broker: Pubkey,

    /// Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinity.
    pub max_taker_sell_count: u32,

    /// Pool configuration values.
    pub config: PoolConfig,

    /// Reserved space for future upgrades.
    pub _reserved: [u8; 100],
}

impl Pool {
    /// Determines if a taker is able to sell into a pool.
    pub fn taker_allowed_to_sell(&self) -> Result<()> {
        //0 indicates no restriction on buy count / if no shared_escrow, not relevant
        if self.max_taker_sell_count == 0 || self.shared_escrow == Pubkey::default() {
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

    /// Checks that editing pools does not result in setting a new cap that is too low.
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

    /// Calculate the fee the MM receives when providing liquidity to a two-sided pool.
    pub fn calc_mm_fee(&self, current_price: u64) -> Result<u64> {
        let fee = match self.config.pool_type {
            PoolType::Trade => {
                unwrap_checked!({
                    (self.config.mm_fee_bps as u64)
                        .checked_mul(current_price)?
                        .checked_div(HUNDRED_PCT_BPS)
                })
            }
            PoolType::NFT | PoolType::Token => 0, // No mm fees for NFT or Token pools
        };

        Ok(fee)
    }

    /// Calculate the price of the pool after shifting it by a certain offset.
    pub fn current_price(&self, side: TakerSide) -> Result<u64> {
        match (self.config.pool_type, side) {
            (PoolType::Trade, TakerSide::Buy)
            | (PoolType::NFT, TakerSide::Buy)
            | (PoolType::Token, TakerSide::Sell) => self.shift_price(self.price_offset, side),

            // Trade pool sells require the price to be shifted down by 1 to prevent
            // liquidity from being drained by repeated matched buys and sells.
            (PoolType::Trade, TakerSide::Sell) => self.shift_price(self.price_offset - 1, side),

            // Invalid combinations of pool type and side.
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
    }

    /// Shifts the price of a pool by a certain offset.
    pub fn shift_price(&self, price_offset: i32, side: TakerSide) -> Result<u64> {
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
                    PreciseNumber::new((HUNDRED_PCT_BPS).checked_add(self.config.delta)?.into())?
                        .checked_div(&hundred_pct)?
                        .checked_pow(offset.into())
                });

                let result = unwrap_int!(match direction {
                    // price * (1 + delta)^trade_count
                    Direction::Up => base.checked_mul(&factor),
                    //same but / instead of *
                    Direction::Down => base.checked_div(&factor),
                });

                let rounded_result = unwrap_int!(match side {
                    TakerSide::Buy => result.ceiling(),
                    TakerSide::Sell => result.floor(),
                });

                unwrap_int!(u64::try_from(unwrap_checked!({ rounded_result.to_imprecise() })).ok())
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

    /// Returns the seeds for the pool account.
    pub fn seeds(&self) -> [&[u8]; 4] {
        [
            b"pool",
            self.owner.as_ref(),
            self.pool_id.as_ref(),
            &self.bump,
        ]
    }

    pub fn validate_maker_broker(&self, maker_broker: &Option<UncheckedAccount>) -> Result<()> {
        // If the pool has a maker broker, the maker broker account must be passed in.
        if self.maker_broker == Pubkey::default() {
            return Ok(());
        }
        require!(
            maker_broker
                .as_ref()
                .ok_or(ErrorCode::MissingMakerBroker)?
                .key()
                == self.maker_broker,
            ErrorCode::WrongMakerBroker
        );
        Ok(())
    }

    pub fn validate_cosigner(&self, cosigner: &Option<Signer>) -> Result<()> {
        // If the pool has a cosigner, the cosigner account must be passed in.
        if self.cosigner == Pubkey::default() {
            return Ok(());
        }
        require!(
            cosigner.as_ref().ok_or(ErrorCode::MissingCosigner)?.key() == self.cosigner,
            ErrorCode::WrongCosigner
        );
        Ok(())
    }
}

/// Indicates the direction of a price shift.
pub enum Direction {
    Up,
    Down,
}

/// Indicates the side of the taker.
#[derive(PartialEq, Eq, Copy, Clone)]
pub enum TakerSide {
    Buy,  // Buying from the pool.
    Sell, // Selling into the pool.
}

/// A utitilty function that tries to autoclose a pool if it is possible.
pub fn try_autoclose_pool<'info>(
    pool: &Account<'info, Pool>,
    rent_payer: AccountInfo<'info>,
    owner: AccountInfo<'info>,
) -> Result<()> {
    match pool.config.pool_type {
        PoolType::Trade => (), // Cannot be auto-closed
        PoolType::Token => {
            // Not enough SOL to purchase another NFT, so we can close the pool.
            if pool.currency == Pubkey::default()
                && pool.amount < pool.current_price(TakerSide::Sell)?
            {
                close_pool(pool, rent_payer, owner)?;
            }
        }
        PoolType::NFT => {
            // No more NFTs to sell, so we can close the pool.
            if pool.nfts_held == 0 {
                close_pool(pool, rent_payer, owner)?;
            }
        }
    }

    Ok(())
}

/// Closes a pool and returns the rent to the rent payer and any remaining SOL to the owner.
pub fn close_pool<'info>(
    pool: &Account<'info, Pool>,
    rent_payer: AccountInfo<'info>,
    owner: AccountInfo<'info>,
) -> Result<()> {
    // The incoming rent payer account must match what's stored on the pool.
    if *rent_payer.key != pool.rent_payer {
        throw_err!(ErrorCode::WrongRentPayer);
    }

    // Sanity check the owner is the owner of the pool.
    if *owner.key != pool.owner {
        throw_err!(ErrorCode::WrongOwner);
    }

    let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
    let pool_lamports = pool.get_lamports();

    // Any SOL above the minimum rent/state bond goes to the owner.
    if pool_lamports > pool_state_bond {
        let owner_amount = unwrap_int!(pool_lamports.checked_sub(pool_state_bond));
        // If owner is not rent exempt, this skips the transfer and the rent destination will get it instead.
        transfer_lamports_checked(&pool.to_account_info(), &owner, owner_amount)?;
    }

    // Rent goes back to the rent payer.
    pool.close(rent_payer)
}

pub fn update_pool_accounting(
    pool: &mut Account<'_, Pool>,
    pool_initial_balance: u64,
    taker_side: TakerSide,
) -> Result<()> {
    // Calculate fees from the current price.
    let current_price = pool.current_price(taker_side)?;
    // This resolves to 0 for Token & NFT pools.
    let mm_fee = pool.calc_mm_fee(current_price)?;

    pool.updated_at = Clock::get()?.unix_timestamp;

    match taker_side {
        TakerSide::Buy => {
            // Taker has bought an NFT from the pool, so we decrement the NFT counter.
            pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

            // Pool has sold an NFT, so we increment the trade counter.
            pool.price_offset = unwrap_int!(pool.price_offset.checked_add(1));

            pool.stats.taker_buy_count = unwrap_int!(pool.stats.taker_buy_count.checked_add(1));

            if pool.config.pool_type == PoolType::Trade {
                pool.stats.accumulated_mm_profit =
                    unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
            }

            // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
            // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
            if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
                let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
                let pool_final_balance = pool.get_lamports();
                let lamports_added =
                    unwrap_checked!({ pool_final_balance.checked_sub(pool_initial_balance) });
                pool.amount = unwrap_checked!({ pool.amount.checked_add(lamports_added) });

                // Sanity check to avoid edge cases:
                require!(
                    pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
                    ErrorCode::InvalidPoolAmount
                );
            }
        }
        TakerSide::Sell => {
            if pool.config.pool_type == PoolType::Trade {
                pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

                pool.stats.accumulated_mm_profit =
                    unwrap_int!(pool.stats.accumulated_mm_profit.checked_add(mm_fee));
            }

            // Pool has bought an NFT, so we decrement the trade counter.
            pool.price_offset = unwrap_int!(pool.price_offset.checked_sub(1));
            pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));

            // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
            if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
                let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
                let pool_final_balance = pool.get_lamports();
                let lamports_taken =
                    unwrap_checked!({ pool_initial_balance.checked_sub(pool_final_balance) });
                pool.amount = unwrap_checked!({ pool.amount.checked_sub(lamports_taken) });

                // Sanity check to avoid edge cases:
                require!(
                    pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
                    ErrorCode::InvalidPoolAmount
                );
            }
        }
    }

    Ok(())
}
