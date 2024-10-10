//! Constants used in the program.
use anchor_lang::prelude::*;
use solana_program::pubkey;

// (!) DONT USE UNDERSCORES (3_000) OR WONT BE ABLE TO READ JS-SIDE

/// Current version of the pool account.
#[constant]
pub const CURRENT_POOL_VERSION: u8 = 1;

/// Maximum allowed MM fees in basis points.
#[constant]
pub const MAX_MM_FEES_BPS: u16 = 9999; //99%
/// Maximum delta in basis points for a trade pool.
#[constant]
pub const MAX_DELTA_BPS: u16 = 9999; //99%

/// The pubkey of the Tensor Foundation Fees program.
pub(crate) const TFEE_PROGRAM_ID: Pubkey = pubkey!("TFEEgwDP6nn1s8mMX2tTNPPz8j2VomkphLUmyxKm17A");

pub(crate) const DISCRIMINATOR_SIZE: usize = 8;
