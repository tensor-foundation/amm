use super::*;

/// Enum for events emitted by the AMM program.
#[derive(AnchorDeserialize, AnchorSerialize)]
#[repr(C)]
pub enum TAmmEvent {
    BuySellEvent(BuySellEvent),
}

/// Event emitted when a user buys or sells tokens.
#[derive(AnchorDeserialize, AnchorSerialize)]
#[repr(C)]
pub struct BuySellEvent {
    pub current_price: u64,
    pub taker_fee: u64,
    pub mm_fee: u64,
    pub creators_fee: u64,
}
