use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use vipers::Validate;

use crate::SharedEscrow;

#[derive(Accounts)]
pub struct DepositSharedEscrow<'info> {
    #[account(
        mut,
        seeds = [
            b"shared_escrow".as_ref(),
            owner.key().as_ref(),
            &shared_escrow.nr.to_le_bytes()
        ],
        bump = shared_escrow.bump[0],
        has_one = owner,
    )]
    pub shared_escrow: Box<Account<'info, SharedEscrow>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for DepositSharedEscrow<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

impl<'info> DepositSharedEscrow<'info> {
    fn transfer_lamports(&self, lamports: u64) -> Result<()> {
        invoke(
            &system_instruction::transfer(self.owner.key, &self.shared_escrow.key(), lamports),
            &[
                self.owner.to_account_info(),
                self.shared_escrow.to_account_info(),
                self.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_deposit_shared_escrow(
    ctx: Context<DepositSharedEscrow>,
    lamports: u64,
) -> Result<()> {
    // do the transfer
    ctx.accounts.transfer_lamports(lamports)?;

    Ok(())
}
