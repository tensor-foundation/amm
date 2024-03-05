use anchor_lang::prelude::*;

use crate::state::{MyAccount, MyData, MY_ACCOUNT_SIZE};

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = MY_ACCOUNT_SIZE
    )]
    pub address: Account<'info, MyAccount>,

    /// CHECK: can be any account
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_create(ctx: Context<Create>, arg1: u16, arg2: u32) -> Result<()> {
    ctx.accounts.address.authority = *ctx.accounts.authority.key;
    ctx.accounts.address.data = MyData {
        field1: arg1,
        field2: arg2,
    };

    Ok(())
}
