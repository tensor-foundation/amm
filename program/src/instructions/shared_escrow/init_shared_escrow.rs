use anchor_lang::prelude::*;
use vipers::Validate;

use crate::{SharedEscrow, SHARED_ESCROW_SIZE};

#[derive(Accounts)]
#[instruction(margin_nr: u16)]
pub struct InitSharedEscrow<'info> {
    /// CHECK: if an account with this nr already exists, init will fail
    #[account(
        init, payer = owner,
        seeds = [
            b"shared_escrow".as_ref(),
            // TODO: remove tswap from seed in V2 (annoying to have to pass account eg in CPIs).
            owner.key().as_ref(),
            &margin_nr.to_le_bytes()
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
    margin_nr: u16,
    name: [u8; 32],
) -> Result<()> {
    let margin = &mut ctx.accounts.shared_escrow;

    margin.owner = ctx.accounts.owner.key();
    margin.name = name;
    margin.nr = margin_nr;
    margin.bump = [ctx.bumps.shared_escrow];

    Ok(())
}
