use anchor_lang::prelude::*;

// (!) DONT USE UNDERSCORES (3_000) OR WONT BE ABLE TO READ JS-SIDE
#[constant]
pub const CURRENT_TSWAP_VERSION: u8 = 0;

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

//(!) Keep in sync with TBID_FEE_BPS and SDK constants
#[constant]
pub const TSWAP_TAKER_FEE_BPS: u16 = 150;
//taken out of taker fee
#[constant]
pub const MAKER_REBATE_BPS: u16 = 25;

//fixed fee applied on top of initial snipe value
//eg if user wants to snipe for 100, we charge 1.5% on top
//(!) should always >= STANDARD_FEE_BPS
#[constant]
pub const SNIPE_FEE_BPS: u16 = 150;
//needed so that we don't get drained for creating PDAs (0.01 sol)
#[constant]
pub const SNIPE_MIN_FEE: u64 = 10000000;

//profit share, so eg if we snipe for 90 instead of 100 and profit share is 20%, we take home 20% * (100-90) = 2
#[constant]
pub const SNIPE_PROFIT_SHARE_BPS: u16 = 2000;

#[constant]
pub const TAKER_BROKER_PCT: u64 = 0;
