use anchor_lang::prelude::*;

pub mod pool;
pub use pool::*;

/// Need dummy Anchor account so we can use `close` constraint.
#[account]
pub struct SolEscrow {}
