use anchor_lang::prelude::*;

#[constant]
pub const CURRENT_POOL_VERSION: u8 = 0;

#[constant]
pub const MAX_MM_FEES_BPS: u16 = 9999; //99%
#[constant]
pub const MAX_DELTA_BPS: u16 = 9999; //99%
