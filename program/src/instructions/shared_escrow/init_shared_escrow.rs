use anchor_lang::prelude::*;
use vipers::Validate;

use crate::{SharedEscrow, SHARED_ESCROW_SIZE};

#[derive(Accounts)]
#[instruction(shared_escrow_nr: u16)]
pub struct InitSharedEscrow<'info> {
    /// CHECK: if an account with this nr already exists, init will fail
    #[account(
        init, payer = owner,
        seeds = [
            b"shared_escrow".as_ref(),
            owner.key().as_ref(),
            &shared_escrow_nr.to_le_bytes()
        ],
        bump,
        space = SHARED_ESCROW_SIZE,
    )]
    pub shared_escrow: Box<Account<'info, SharedEscrow>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for InitSharedEscrow<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_init_shared_escrow(
    ctx: Context<InitSharedEscrow>,
    shared_escrow_nr: u16,
    name: [u8; 32],
) -> Result<()> {
    let shared_escrow = &mut ctx.accounts.shared_escrow;

    shared_escrow.owner = ctx.accounts.owner.key();
    shared_escrow.name = name;
    shared_escrow.nr = shared_escrow_nr;
    shared_escrow.bump = [ctx.bumps.shared_escrow];

    Ok(())
}
