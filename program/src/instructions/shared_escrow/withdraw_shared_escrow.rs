use anchor_lang::prelude::*;
use tensor_toolbox::transfer_lamports_from_pda;
use vipers::Validate;

use crate::SharedEscrow;

#[derive(Accounts)]
pub struct WithdrawSharedEscrow<'info> {
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

impl<'info> Validate<'info> for WithdrawSharedEscrow<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

impl<'info> WithdrawSharedEscrow<'info> {
    fn transfer_lamports_to_owner(&self, lamports: u64) -> Result<()> {
        transfer_lamports_from_pda(
            &self.shared_escrow.to_account_info(),
            &self.owner.to_account_info(),
            lamports,
        )
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_withdraw_shared_escrow(
    ctx: Context<WithdrawSharedEscrow>,
    lamports: u64,
) -> Result<()> {
    // do the transfer
    ctx.accounts.transfer_lamports_to_owner(lamports)?;

    Ok(())
}
