//! Constants used in the program.
use anchor_lang::prelude::*;
use solana_program::pubkey;

// (!) DONT USE UNDERSCORES (3_000) OR WONT BE ABLE TO READ JS-SIDE

/// Current version of the program.
#[constant]
pub const CURRENT_TAMM_VERSION: u8 = 0;

/// Current version of the pool account.
#[constant]
pub const CURRENT_POOL_VERSION: u8 = 0;

/// Maximum allowed MM fees in basis points.
#[constant]
pub const MAX_MM_FEES_BPS: u16 = 9999; //99%
/// Utility constant for 100% in basis points.
#[constant]
pub const HUNDRED_PCT_BPS: u16 = 10000;
/// Maximum delta in basis points for a trade pool.
#[constant]
pub const MAX_DELTA_BPS: u16 = 9999; //99%

// --------------------------------------- fees

/// Taker fee in basis points.
#[constant]
pub const TAKER_FEE_BPS: u16 = 200;

/// Broker fee as a percentage of the taker fee.
#[constant]
pub const BROKER_FEE_PCT: u8 = 50;

/// Maker broker fee as a percentage of the total Broker Fee.
#[constant]
pub const MAKER_BROKER_PCT: u8 = 80;

pub(crate) const TFEE_PROGRAM_ID: Pubkey = pubkey!("TFEEgwDP6nn1s8mMX2tTNPPz8j2VomkphLUmyxKm17A");
