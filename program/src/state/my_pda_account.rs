use anchor_lang::prelude::*;

#[constant]
#[allow(clippy::identity_op)]
pub const MY_PDA_ACCOUNT_SIZE: usize = 8 + 1;

#[account]
pub struct MyPdaAccount {
    pub bump: u8,
}
