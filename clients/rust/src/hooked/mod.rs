pub mod currency;
pub mod fees;
pub mod nullable;
pub mod pool;

pub use currency::*;
pub use fees::*;
pub use nullable::*;

pub const HUNDRED_PCT_BPS: u16 = 10000;
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const BROKER_FEE_PCT: u64 = 50;
pub const MAKER_BROKER_PCT: u8 = 80;
pub const TAKER_FEE_BPS: u64 = 200;
