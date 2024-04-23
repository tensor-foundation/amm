use super::*;

#[derive(AnchorDeserialize, AnchorSerialize)]
#[repr(C)]
pub enum TAmmEvent {
    BuySellEvent(BuySellEvent),
}

#[derive(AnchorDeserialize, AnchorSerialize)]
#[repr(C)]
pub struct BuySellEvent {
    pub current_price: u64,
    pub tswap_fee: u64,
    pub mm_fee: u64,
    pub creators_fee: u64,
}
