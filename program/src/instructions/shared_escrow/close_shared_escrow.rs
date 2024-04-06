use anchor_lang::prelude::*;
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, SharedEscrow};

#[derive(Accounts)]
pub struct CloseSharedEscrow<'info> {
    #[account(
        mut,
        seeds = [
            b"shared_escrow".as_ref(),
            owner.key().as_ref(),
            &shared_escrow.nr.to_le_bytes()
        ],
        bump = shared_escrow.bump[0],
        has_one = owner,
        close = owner
    )]
    pub shared_escrow: Box<Account<'info, SharedEscrow>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CloseSharedEscrow<'info> {
    fn validate(&self) -> Result<()> {
        // Cannot close if pools are attached.
        if self.shared_escrow.pools_attached > 0 {
            throw_err!(ErrorCode::SharedEscrowInUse);
        }
        Ok(())
    }
}

//since we're storing all funds on the account itself, this will drain the funds to the owner
//TODO: in the future when we add NFTs owned by shared escrow account this will have to also check that no NFTs are left
#[access_control(ctx.accounts.validate())]
pub fn process_close_shared_escrow(ctx: Context<CloseSharedEscrow>) -> Result<()> {
    Ok(())
}
