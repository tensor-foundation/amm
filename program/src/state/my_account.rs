use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

#[constant]
#[allow(clippy::identity_op)]
pub const MY_ACCOUNT_SIZE: usize = 8 + 32 + 2 + 4;

#[account]
pub struct MyAccount {
    pub authority: Pubkey,
    pub data: MyData,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct MyData {
    pub field1: u16,
    pub field2: u32,
}
