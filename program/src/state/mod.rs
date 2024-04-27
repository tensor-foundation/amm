pub mod event;
pub mod nft_deposit_receipt;
pub mod pool;
pub mod single_listing;

pub use event::*;
pub use nft_deposit_receipt::*;
pub use pool::*;
pub use single_listing::*;

use anchor_lang::prelude::*;
use mpl_token_metadata::types::{AuthorizationData, Payload, PayloadType, ProofInfo, SeedsVec};
use solana_program::pubkey;
use std::collections::HashMap;

pub const MAX_EXPIRY_SEC: i64 = 365 * 24 * 60 * 60; // 1 year, 31,536,000 seconds

// TODO: replace with actual treasury address.
pub const FDN_TREASURY: Pubkey = pubkey!("Hnozy7VdXR1ua2FZQyvxRgoCbn2dnpVZh3vZN9BMzDea");

pub const FEE_KEEP_ALIVE_LAMPORTS: u64 = 890880;

#[derive(Accounts)]
pub struct DummyCtx<'info> {
    //have to have 1 entry in order for lifetime arg to be used (else complains during CPI into tensorswap)
    pub system_program: Program<'info, System>,
}

/// Sharded fee accounts
/// Seeds: "fee_vault", number, bump
/// There are up to 256 fee accounts, and the number in the seed
/// is found by getting the last byte of mint pubkey.
#[account]
pub struct FeeVault {}

// --------------------------------------- events

#[event]
pub struct DelistEvent {
    #[index]
    pub current_price: u64,
}

// --------------------------------------- replicating mplex type for anchor IDL export
//have to do this because anchor won't include foreign structs in the IDL

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
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct TaggedPayload {
    pub name: String,
    pub payload: PayloadTypeLocal,
}

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
    use crate::constants::{HUNDRED_PCT_BPS, TAKER_FEE_BPS};

    use super::*;

    use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
    use spl_math::precise_number::PreciseNumber;
    use tensor_toolbox::NullableOption;

    impl Pool {
        pub fn new(
            pool_type: PoolType,
            curve_type: CurveType,
            starting_price: u64,
            delta: u64,
            price_offset: i32,
            mm_fee_bps: NullableOption<u16>,
        ) -> Self {
            Self {
                version: 1,
                bump: [1],
                created_at: 1234,
                updated_at: 0,
                expiry: 0,
                owner: Pubkey::default(),
                cosigner: NullableOption::none(),
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
                shared_escrow: NullableOption::none(),
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
            NullableOption::new(1000), //10%
        );

        assert_eq!(
            p.calc_mm_fee(LAMPORTS_PER_SOL).unwrap(),
            LAMPORTS_PER_SOL / 10
        );

        p.config.mm_fee_bps = NullableOption::new(123);
        assert_eq!(
            p.calc_mm_fee(LAMPORTS_PER_SOL).unwrap(),
            LAMPORTS_PER_SOL * 123 / 10000
        );

        //if price too small, fee will start to look weird, but who cares at these levels
        p.config.mm_fee_bps = NullableOption::new(2499);
        assert_eq!(p.calc_mm_fee(10).unwrap(), 2); //2.499 floored

        p.config.mm_fee_bps = NullableOption::new(2499);
        assert_eq!(p.calc_mm_fee(100).unwrap(), 24); //24.99 floored

        p.config.mm_fee_bps = NullableOption::new(2499);
        assert_eq!(p.calc_mm_fee(1000).unwrap(), 249); //249.9 floored
    }

    #[test]
    fn tst_tswap_fees() {
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            LAMPORTS_PER_SOL,
            LAMPORTS_PER_SOL,
            0,
            NullableOption::none(),
        );

        assert_eq!(
            p.calc_tswap_fee(LAMPORTS_PER_SOL).unwrap(),
            LAMPORTS_PER_SOL * TAKER_FEE_BPS as u64 / 10000
        );
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::<u16>::none(),
        );
        p.current_price(TakerSide::Buy).unwrap();
    }

    #[test]
    fn test_linear_trade_pool_sell_side_upper() {
        let delta = LAMPORTS_PER_SOL * 10_000_000_000;
        let p = Pool::new(
            PoolType::Trade,
            CurveType::Linear,
            delta,
            delta,
            1,
            NullableOption::none(),
        );
        // This shouldn't oveflow for sell side (1 tick lower).
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), delta);
    }

    // --------------------------------------- exponential

    const MAX_BPS: u64 = HUNDRED_PCT_BPS as u64;

    fn calc_price_frac(price: u64, numer: u64, denom: u64) -> u64 {
        u64::try_from(
            PreciseNumber::new(price.into())
                .unwrap()
                .checked_mul(&PreciseNumber::new(numer.into()).unwrap())
                .unwrap()
                .checked_div(&PreciseNumber::new(denom.into()).unwrap())
                .unwrap()
                .to_imprecise()
                .unwrap(),
        )
        .unwrap()
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
            NullableOption::none(),
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
            calc_price_frac(LAMPORTS_PER_SOL, MAX_BPS, 13310)
        );

        p.price_offset -= 7;
        // This one has very small rounding error (within 1 bps).
        assert!((p.current_price(TakerSide::Sell).unwrap()) > LAMPORTS_PER_SOL * MAX_BPS / 25938);
        assert!((p.current_price(TakerSide::Sell).unwrap()) < LAMPORTS_PER_SOL * MAX_BPS / 25937);

        p.price_offset -= 90;
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            calc_price_frac(LAMPORTS_PER_SOL, MAX_BPS, 137806123)
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            NullableOption::none(),
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
            LAMPORTS_PER_SOL * MAX_BPS / 11000
        );
        assert_eq!(
            p.current_price(TakerSide::Sell).unwrap(),
            calc_price_frac(LAMPORTS_PER_SOL, MAX_BPS, 12100)
        );
        p.price_offset -= 2;
        assert_eq!(
            p.current_price(TakerSide::Buy).unwrap(),
            calc_price_frac(LAMPORTS_PER_SOL, MAX_BPS, 13310)
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
            NullableOption::none(),
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
            NullableOption::none(),
        );
        // 1 tick lower, should not panic.
        assert_eq!(p.current_price(TakerSide::Sell).unwrap(), u64::MAX - 1);
    }
}
