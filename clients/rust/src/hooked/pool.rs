use std::fmt::{self, Display, Formatter};

use crate::accounts::Pool;
use crate::errors::TensorAmmError;
use crate::types::{CurveType, Direction, PoolStats, PoolType, TakerSide};
use crate::HUNDRED_PCT_BPS;

use spl_math::precise_number::PreciseNumber;

#[allow(clippy::derivable_impls)]
impl Default for PoolStats {
    fn default() -> Self {
        Self {
            taker_sell_count: 0,
            taker_buy_count: 0,
            accumulated_mm_profit: 0,
        }
    }
}

impl Pool {
    /// Shifts the price of a pool by a certain offset.
    pub fn shift_price(&self, price_offset: i32, side: TakerSide) -> Result<u64, TensorAmmError> {
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
                    Direction::Up => base
                        .checked_add(
                            delta
                                .checked_mul(offset as u64)
                                .ok_or(TensorAmmError::ArithmeticError)?,
                        )
                        .ok_or(TensorAmmError::ArithmeticError)?,
                    Direction::Down => base
                        .checked_sub(
                            delta
                                .checked_mul(offset as u64)
                                .ok_or(TensorAmmError::ArithmeticError)?,
                        )
                        .ok_or(TensorAmmError::ArithmeticError)?,
                }
            }
            CurveType::Exponential => {
                let hundred_pct = PreciseNumber::new(HUNDRED_PCT_BPS.into())
                    .ok_or(TensorAmmError::ArithmeticError)?;

                let base = PreciseNumber::new(self.config.starting_price.into())
                    .ok_or(TensorAmmError::ArithmeticError)?;

                let factor = PreciseNumber::new(
                    (HUNDRED_PCT_BPS as u64)
                        .checked_add(self.config.delta)
                        .ok_or(TensorAmmError::ArithmeticError)?
                        .into(),
                )
                .ok_or(TensorAmmError::ArithmeticError)?
                .checked_div(&hundred_pct)
                .ok_or(TensorAmmError::ArithmeticError)?
                .checked_pow(offset.into())
                .ok_or(TensorAmmError::ArithmeticError)?;

                let result = match direction {
                    // price * (1 + delta)^trade_count
                    Direction::Up => base.checked_mul(&factor),
                    //same but / instead of *
                    Direction::Down => base.checked_div(&factor),
                };

                let rounded_result = match side {
                    TakerSide::Buy => result.ok_or(TensorAmmError::ArithmeticError)?.ceiling(),
                    TakerSide::Sell => result.ok_or(TensorAmmError::ArithmeticError)?.floor(),
                };

                let imprecise = rounded_result
                    .ok_or(TensorAmmError::ArithmeticError)?
                    .to_imprecise()
                    .ok_or(TensorAmmError::ArithmeticError)?;

                u64::try_from(imprecise)
                    .ok()
                    .ok_or(TensorAmmError::ArithmeticError)?
            }
        };

        Ok(current_price)
    }

    /// Calculate the price of the pool after shifting it by a certain offset.
    pub fn current_price(&self, side: TakerSide) -> Result<u64, TensorAmmError> {
        match (self.config.pool_type, side) {
            (PoolType::Trade, TakerSide::Buy)
            | (PoolType::Token, TakerSide::Sell)
            | (PoolType::NFT, TakerSide::Buy) => self.shift_price(self.price_offset, side),

            // Trade pool sells require the price to be shifted down by 1 to prevent
            // liquidity from being drained by repeated matched buys and sells.
            (PoolType::Trade, TakerSide::Sell) => self.shift_price(self.price_offset - 1, side),

            // Invalid combinations of pool type and side.
            _ => Err(TensorAmmError::WrongPoolType),
        }
    }
}

impl Display for PoolType {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            PoolType::Trade => write!(f, "Trade"),
            PoolType::Token => write!(f, "Token"),
            PoolType::NFT => write!(f, "NFT"),
        }
    }
}

impl Display for CurveType {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            CurveType::Linear => write!(f, "Linear"),
            CurveType::Exponential => write!(f, "Exponential"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use solana_program::pubkey::Pubkey;

    use crate::{
        types::{PoolConfig, PoolStats},
        Currency, NullableAddress, NullableU16, LAMPORTS_PER_SOL,
    };

    impl Pool {
        pub fn new_test_pool(
            pool_type: PoolType,
            curve_type: CurveType,
            starting_price: u64,
            delta: u64,
            price_offset: i32,
            mm_fee_bps: NullableU16,
        ) -> Self {
            Self {
                discriminator: [0; 8],
                version: 1,
                bump: [1],
                created_at: 1234,
                updated_at: 0,
                expiry: 0,
                owner: Pubkey::default(),
                cosigner: NullableAddress::none(),
                maker_broker: NullableAddress::none(),
                rent_payer: Pubkey::default(),
                whitelist: Pubkey::default(),
                pool_id: [0; 32],
                config: PoolConfig {
                    pool_type,
                    curve_type,
                    starting_price,
                    delta,
                    mm_compound_fees: true,
                    mm_fee_bps,
                },
                price_offset,
                nfts_held: 0,
                stats: PoolStats::default(),
                currency: Currency::sol(),
                amount: 0,
                shared_escrow: NullableAddress::none(),
                max_taker_sell_count: 10,
                reserved: [0; 100],
            }
        }
    }

    // --------------------------------------- Linear

    // Token Pool

    #[test]
    fn test_linear_token_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new_test_pool(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            NullableU16::none(),
        );
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), LAMPORTS_PER_SOL);

        // The pool has bought 1 NFT so has a trade "deficit".
        // The price should be shifted down by 1 delta.
        p.price_offset -= 1;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta
        );

        // The pool has bought 2 additional NFTs so has a trade "deficit" of 3.
        // The price should be shifted down by 3 deltas.
        p.price_offset -= 2;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta * 3
        );

        // The pool has bought 7 additional NFTs so has a trade "deficit" of 10.
        // The price should be shifted down by 10 deltas.
        p.price_offset -= 7;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta * 10
        );

        // The current price should now be zero, because the pool has spent all its SOL.
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), 0);
    }

    #[test]
    #[should_panic(expected = "ArithmeticError")]
    fn test_linear_token_pool_panic_overflow() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new_test_pool(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -11,
            NullableU16::none(),
        );
        // Should overflow when we calculate the current price
        // because the trade difference is more than the maximum
        // and we cannot have a negative price.
        p.current_price(TakerSide::Sell).unwrap();
    }

    #[test]
    #[should_panic(expected = "WrongPoolType")]
    fn test_linear_token_pool_panic_on_buy() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new_test_pool(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            NullableU16::none(),
        );
        // Token pools only buy NFTs (seller sells into them),
        // so the taker side cannot be buy.
        p.current_price(TakerSide::Buy).unwrap();
    }

    // NFT Pool

    #[test]
    fn test_linear_nft_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new_test_pool(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            NullableU16::none(),
        );
        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);

        //  Trade surplus because Pool has sold NFT to taker.
        // Current price should be shifted up by 1 delta.
        p.price_offset += 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta
        );

        // Sell an additional 2 NFTs to taker and the trade surplus is 3.
        p.price_offset += 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta * 3
        );

        // Price continues to go up.
        // Real pools will run out of NTFs to sell at some point,
        // but the price calculation in this test should still go up.
        p.price_offset += 9999996;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta * 9999999
        );
    }

    #[test]
    #[should_panic(expected = "ArithmeticError")]
    fn test_linear_nft_pool_panic_overflow() {
        let delta = LAMPORTS_PER_SOL / 10 * 100;
        let p = Pool::new_test_pool(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL * 100,
            delta,
            i32::MAX - 1, //get this to overflow
            NullableU16::none(),
        );
        // Cannot go higher
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    #[should_panic(expected = "WrongPoolType")]
    fn test_linear_nft_pool_panic_on_sell() {
        let delta = LAMPORTS_PER_SOL / 10 * 100;
        let p = Pool::new_test_pool(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL * 100,
            delta,
            0,
            NullableU16::none(),
        );
        // NFT pools only sell NFTs (buyer buys from them).
        p.current_price(TakerSide::Sell).unwrap();
    }

    // Trade Pool

    #[test]
    fn test_linear_trade_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new_test_pool(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            NullableU16::none(),
        );
        // NB: selling into the pool is always 1 delta lower than buying.

        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta
        );

        //pool's a buyer -> price goes down
        p.price_offset -= 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL - delta
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta * 2
        );

        p.price_offset -= 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL - delta * 3
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta * 4
        );
        //pool can pay 0
        p.price_offset -= 7;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL - delta * 10
        );

        // Sell price will overflow.

        //pool's neutral
        p.price_offset += 10;
        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL - delta
        );

        //pool's a seller -> price goes up
        p.price_offset += 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta
        );
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), LAMPORTS_PER_SOL);

        p.price_offset += 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta * 3
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL + delta * 2
        );
        //go much higher
        p.price_offset += 9999996;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL + delta * 9999999
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL + delta * 9999998
        );
    }

    #[test]
    #[should_panic(expected = "ArithmeticError")]
    fn test_linear_trade_pool_panic_lower() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new_test_pool(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -11,
            NullableU16::none(),
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    #[should_panic(expected = "ArithmeticError")]
    fn test_linear_trade_pool_panic_sell_side_lower() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new_test_pool(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -10, //10+1 tick for selling = overflow
            NullableU16::none(),
        );
        p.current_price(TakerSide::Sell).unwrap();
    }

    #[test]
    #[should_panic(expected = "ArithmeticError")]
    fn test_linear_trade_pool_panic_upper() {
        let delta = LAMPORTS_PER_SOL * 10_000_000_000;
        let p = Pool::new_test_pool(
            PoolType::Trade,
            CurveType::Linear,
            delta,
            delta,
            1, //just enough to overflow
            NullableU16::none(),
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    fn test_linear_trade_pool_sell_side_upper() {
        let delta = LAMPORTS_PER_SOL * 10_000_000_000;
        let p = Pool::new_test_pool(
            PoolType::Trade,
            CurveType::Linear,
            delta,
            delta,
            1,
            NullableU16::none(),
        );
        // This shouldn't oveflow for sell side (1 tick lower).
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), delta);
    }
}
