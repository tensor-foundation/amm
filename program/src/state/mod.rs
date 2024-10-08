//! Program state.
pub mod asset_deposit_receipt;
pub mod event;
pub mod nft_deposit_receipt;
pub mod pool;

pub use asset_deposit_receipt::*;
pub use event::*;
pub use nft_deposit_receipt::*;
pub use pool::*;

use anchor_lang::prelude::*;
use mpl_token_metadata::types::{AuthorizationData, Payload, PayloadType, ProofInfo, SeedsVec};
use std::collections::HashMap;

/// Maximum expiration time for a pool--one year.
pub const MAX_EXPIRY_SEC: i64 = 365 * 24 * 60 * 60;

// --------------------------------------- replicating mplex type for anchor IDL export
// have to do this because anchor won't include foreign structs in the IDL

/// Local version of `AuthorizationData` for IDL export.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct AuthorizationDataLocal {
    pub payload: Vec<TaggedPayload>,
}
impl From<AuthorizationDataLocal> for AuthorizationData {
    fn from(val: AuthorizationDataLocal) -> Self {
        let mut map = HashMap::<String, PayloadType>::new();
        val.payload.into_iter().for_each(|tp| {
            map.insert(tp.name, PayloadType::from(tp.payload));
        });
        AuthorizationData {
            payload: Payload { map },
        }
    }
}

//Unfortunately anchor doesn't like HashMaps, nor Tuples, so you can't pass in:
// HashMap<String, PayloadType>, nor
// Vec<(String, PayloadTypeLocal)>
// so have to create this stupid temp struct for IDL to serialize correctly

/// Local version of `TaggedPayload` for IDL export.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct TaggedPayload {
    pub name: String,
    pub payload: PayloadTypeLocal,
}

/// Local version of `PayloadType` for IDL export.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub enum PayloadTypeLocal {
    /// A plain `Pubkey`.
    Pubkey(Pubkey),
    /// PDA derivation seeds.
    Seeds(SeedsVecLocal),
    /// A merkle proof.
    MerkleProof(ProofInfoLocal),
    /// A plain `u64` used for `Amount`.
    Number(u64),
}
impl From<PayloadTypeLocal> for PayloadType {
    fn from(val: PayloadTypeLocal) -> Self {
        match val {
            PayloadTypeLocal::Pubkey(pubkey) => PayloadType::Pubkey(pubkey),
            PayloadTypeLocal::Seeds(seeds) => PayloadType::Seeds(SeedsVec::from(seeds)),
            PayloadTypeLocal::MerkleProof(proof) => {
                PayloadType::MerkleProof(ProofInfo::from(proof))
            }
            PayloadTypeLocal::Number(number) => PayloadType::Number(number),
        }
    }
}

/// Local version of `SeedsVec` for IDL export.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct SeedsVecLocal {
    /// The vector of derivation seeds.
    pub seeds: Vec<Vec<u8>>,
}
impl From<SeedsVecLocal> for SeedsVec {
    fn from(val: SeedsVecLocal) -> Self {
        SeedsVec { seeds: val.seeds }
    }
}

/// Local version of `ProofInfo` for IDL export.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ProofInfoLocal {
    /// The merkle proof.
    pub proof: Vec<[u8; 32]>,
}
impl From<ProofInfoLocal> for ProofInfo {
    fn from(val: ProofInfoLocal) -> Self {
        ProofInfo { proof: val.proof }
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
    use spl_math::precise_number::PreciseNumber;
    use tensor_toolbox::HUNDRED_PCT_BPS;

    impl Pool {
        pub fn new(
            pool_type: PoolType,
            curve_type: CurveType,
            starting_price: u64,
            delta: u64,
            price_offset: i32,
            mm_fee_bps: u16,
        ) -> Self {
            Self {
                version: 1,
                bump: [1],
                created_at: 1234,
                updated_at: 0,
                expiry: 0,
                owner: Pubkey::default(),
                cosigner: Pubkey::default(),
                maker_broker: Pubkey::default(),
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
                currency: Pubkey::default(),
                amount: 0,
                shared_escrow: Pubkey::default(),
                max_taker_sell_count: 10,
                _reserved: [0; 100],
            }
        }
    }

    // --------------------------------------- fees

    #[test]
    fn tst_mm_fees() {
        let mut p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            LAMPORTS_PER_SOL,
            0,
            1000, //10%
        );

        assert_eq!(
            p.calc_mm_fee(LAMPORTS_PER_SOL).unwrap(),
            LAMPORTS_PER_SOL / 10
        );

        p.config.mm_fee_bps = 123;
        assert_eq!(
            p.calc_mm_fee(LAMPORTS_PER_SOL).unwrap(),
            LAMPORTS_PER_SOL * 123 / 10000
        );

        //if price too small, fee will start to look weird, but who cares at these levels
        p.config.mm_fee_bps = 2499;
        assert_eq!(p.calc_mm_fee(10).unwrap(), 2); //2.499 floored

        p.config.mm_fee_bps = 2499;
        assert_eq!(p.calc_mm_fee(100).unwrap(), 24); //24.99 floored

        p.config.mm_fee_bps = 2499;
        assert_eq!(p.calc_mm_fee(1000).unwrap(), 249); //249.9 floored
    }

    // --------------------------------------- Linear

    // Token Pool

    #[test]
    fn test_linear_token_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
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
    #[should_panic(expected = "IntegerOverflow")]
    fn test_linear_token_pool_panic_overflow() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -11,
            0,
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
        let p = Pool::new(
            PoolType::Token,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
        );
        // Token pools only buy NFTs (seller sells into them),
        // so the taker side cannot be buy.
        p.current_price(TakerSide::Buy).unwrap();
    }

    // NFT Pool

    #[test]
    fn test_linear_nft_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
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
    #[should_panic(expected = "IntegerOverflow")]
    fn test_linear_nft_pool_panic_overflow() {
        let delta = LAMPORTS_PER_SOL / 10 * 100;
        let p = Pool::new(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL * 100,
            delta,
            i32::MAX - 1, //get this to overflow
            0,
        );
        // Cannot go higher
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    #[should_panic(expected = "WrongPoolType")]
    fn test_linear_nft_pool_panic_on_sell() {
        let delta = LAMPORTS_PER_SOL / 10 * 100;
        let p = Pool::new(
            PoolType::NFT,
            CurveType::Linear,
            LAMPORTS_PER_SOL * 100,
            delta,
            0,
            0,
        );
        // NFT pools only sell NFTs (buyer buys from them).
        p.current_price(TakerSide::Sell).unwrap();
    }

    // Trade Pool

    #[test]
    fn test_linear_trade_pool() {
        let delta = LAMPORTS_PER_SOL / 10;
        let mut p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
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
    #[should_panic(expected = "IntegerOverflow")]
    fn test_linear_trade_pool_panic_lower() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -11,
            0,
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    #[should_panic(expected = "IntegerOverflow")]
    fn test_linear_trade_pool_panic_sell_side_lower() {
        let delta = LAMPORTS_PER_SOL / 10;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            delta,
            -10, //10+1 tick for selling = overflow
            0,
        );
        p.current_price(TakerSide::Sell).unwrap();
    }

    #[test]
    #[should_panic(expected = "IntegerOverflow")]
    fn test_linear_trade_pool_panic_upper() {
        let delta = LAMPORTS_PER_SOL * 10_000_000_000;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            delta,
            delta,
            1, //just enough to overflow
            0,
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    fn test_linear_trade_pool_sell_side_upper() {
        let delta = LAMPORTS_PER_SOL * 10_000_000_000;
        let p = Pool::new(PoolType::Trade, CurveType::Linear, delta, delta, 1, 0);
        // This shouldn't oveflow for sell side (1 tick lower).
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), delta);
    }

    // --------------------------------------- exponential

    const MAX_BPS: u64 = HUNDRED_PCT_BPS;

    fn calc_price_frac(
        price: u64,
        numer: u64,
        denom: u64,
        _price_offset: i32,
        side: TakerSide,
    ) -> u64 {
        let result = PreciseNumber::new(price.into())
            .unwrap()
            .checked_mul(&PreciseNumber::new(numer.into()).unwrap())
            .unwrap()
            .checked_div(&PreciseNumber::new(denom.into()).unwrap())
            .unwrap();

        let rounded_result = match side {
            TakerSide::Buy => result.ceiling().unwrap(),
            TakerSide::Sell => result.floor().unwrap(),
        };

        u64::try_from(rounded_result.to_imprecise().unwrap()).unwrap()
    }

    #[test]
    fn test_expo_token_pool() {
        let delta = 1000;
        let mut p = Pool::new(
            PoolType::Token,
            CurveType::Exponential,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
        );
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), LAMPORTS_PER_SOL);

        p.price_offset -= 1;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL * MAX_BPS / 11000
        );

        p.price_offset -= 2;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            calc_price_frac(
                LAMPORTS_PER_SOL,
                MAX_BPS,
                13310,
                p.price_offset,
                TakerSide::Sell
            )
        );

        p.price_offset -= 7;
        // This one has very small rounding error (within 1 bps).
        assert!((p.current_price(TakerSide::Sell).unwrap()) > LAMPORTS_PER_SOL * MAX_BPS / 25938);
        assert!((p.current_price(TakerSide::Sell).unwrap()) < LAMPORTS_PER_SOL * MAX_BPS / 25937);

        p.price_offset -= 90;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            calc_price_frac(
                LAMPORTS_PER_SOL,
                MAX_BPS,
                137806123,
                p.price_offset,
                TakerSide::Sell
            )
        );
    }

    // nft

    #[test]
    fn test_expo_nft_pool() {
        let delta = 1000;
        let mut p = Pool::new(
            PoolType::NFT,
            CurveType::Exponential,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
        );
        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);

        p.price_offset += 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL * 11000 / MAX_BPS
        );

        p.price_offset += 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL * 13310 / MAX_BPS
        );

        p.price_offset += 7;
        // This one has very small rounding error (within 1 bps).
        assert!(p.current_price(TakerSide::Buy).unwrap() > LAMPORTS_PER_SOL * 25937 / MAX_BPS);
        assert!(p.current_price(TakerSide::Buy).unwrap() < LAMPORTS_PER_SOL * 25938 / MAX_BPS);

        p.price_offset += 90;
        // This one has very small rounding error (within 1 bps).
        assert!(p.current_price(TakerSide::Buy).unwrap() > LAMPORTS_PER_SOL * 137806123 / MAX_BPS);
        assert!(p.current_price(TakerSide::Buy).unwrap() < LAMPORTS_PER_SOL * 137806124 / MAX_BPS);
    }

    #[test]
    #[should_panic(expected = "IntegerOverflow")]
    fn test_expo_nft_pool_panic() {
        let delta = 1000;
        let p = Pool::new(
            PoolType::NFT,
            CurveType::Exponential,
            LAMPORTS_PER_SOL * 100,
            delta,
            i32::MAX - 1, // this will overflow
            0,
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    // trade

    #[test]
    fn test_expo_trade_pool() {
        let delta = 1000;
        let mut p = Pool::new(
            PoolType::Trade,
            CurveType::Exponential,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
        );
        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL * MAX_BPS / 11000
        );

        //pool's a buyer -> price goes down
        p.price_offset -= 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            calc_price_frac(
                LAMPORTS_PER_SOL,
                MAX_BPS,
                11000,
                p.price_offset,
                TakerSide::Buy
            )
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            calc_price_frac(
                LAMPORTS_PER_SOL,
                MAX_BPS,
                12100,
                p.price_offset,
                TakerSide::Sell
            )
        );
        p.price_offset -= 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            calc_price_frac(
                LAMPORTS_PER_SOL,
                MAX_BPS,
                13310,
                p.price_offset,
                TakerSide::Buy
            )
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL * MAX_BPS / 14641
        );

        //pool's neutral
        p.price_offset += 3;
        assert_eq!(p.current_price(TakerSide::Buy).unwrap(), LAMPORTS_PER_SOL);
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL * MAX_BPS / 11000
        );

        //pool's a seller -> price goes up
        p.price_offset += 1;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL * 11000 / MAX_BPS
        );
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), LAMPORTS_PER_SOL);
        p.price_offset += 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            LAMPORTS_PER_SOL * 13310 / MAX_BPS
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            LAMPORTS_PER_SOL * 12100 / MAX_BPS
        );
    }

    #[test]
    #[should_panic(expected = "IntegerOverflow")]
    fn test_expo_trade_pool_panic_upper() {
        let delta = 1000;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Exponential,
            u64::MAX - 1,
            delta,
            1,
            0,
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    fn test_expo_trade_pool_sell_side_upper() {
        let delta = 1000;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Exponential,
            u64::MAX - 1,
            delta,
            1,
            0,
        );
        // 1 tick lower, should not panic.
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), u64::MAX - 1);
    }

    #[test]
    fn test_expo_rounding_token_pool() {
        let delta = 123;
        let mut p = Pool::new(
            PoolType::Token,
            CurveType::Exponential,
            LAMPORTS_PER_SOL,
            delta,
            0,
            0,
        );

        // Test rounding down for sell (Token pools only handle sells)
        p.price_offset -= 1;
        let price = p.current_price(TakerSide::Sell).unwrap();
        assert_eq!(price, 987_849_451); // Rounded down from 987,849,451.743554282327...
    }

    #[test]
    fn test_expo_rounding_nft_pool() {
        let delta = 123;
        let mut p = Pool::new(PoolType::NFT, CurveType::Exponential, 1_000, delta, 0, 0);

        // Test rounding up for buy (NFT pools only handle buys)
        p.price_offset += 1;
        let price = p.current_price(TakerSide::Buy).unwrap();
        assert_eq!(price, 1013); // Rounded up from 1012.3
    }

    #[test]
    fn test_expo_rounding_trade_pool() {
        let delta = 111;
        let mut p = Pool::new(PoolType::Trade, CurveType::Exponential, 1_000, delta, 0, 0);

        // Test rounding up for buy
        p.price_offset += 1;
        let buy_price = p.current_price(TakerSide::Buy).unwrap();
        assert_eq!(buy_price, 1012); // Rounded up from 1011.1

        // Test rounding down for sell
        p.price_offset -= 1;
        p.config.delta = 789;
        p.config.starting_price = LAMPORTS_PER_SOL;
        let sell_price = p.current_price(TakerSide::Sell).unwrap();
        assert_eq!(sell_price, 926_869_960); // Rounded down from 926,869,960.144591713783...
    }
}
