use anchor_lang::prelude::*;
use solana_program::pubkey;

// (!) DONT USE UNDERSCORES (3_000) OR WONT BE ABLE TO READ JS-SIDE
#[constant]
pub const CURRENT_TAMM_VERSION: u8 = 0;

//version history (these don't match with IDL version):
// v2 = added edit pools functionality
#[constant]
pub const CURRENT_POOL_VERSION: u8 = 2;

#[constant]
pub const MAX_MM_FEES_BPS: u16 = 9999; //99%
#[constant]
pub const HUNDRED_PCT_BPS: u16 = 10000;
#[constant]
pub const MAX_DELTA_BPS: u16 = 9999; //99%

//how many ticks is the spread between a buy and sell for a trade pool
#[constant]
pub const SPREAD_TICKS: u8 = 1;

// --------------------------------------- fees

#[constant]
pub const TAKER_FEE_BPS: u16 = 200;

// 50% of Taker Fee
#[constant]
pub const BROKER_FEE_PCT: u8 = 50;

// 80% of Broker Fee, taker gets the remainder.
#[constant]
pub const MAKER_BROKER_PCT: u8 = 80;

pub(crate) const TFEE_PROGRAM_ID: Pubkey = pubkey!("TFEEgwDP6nn1s8mMX2tTNPPz8j2VomkphLUmyxKm17A");
