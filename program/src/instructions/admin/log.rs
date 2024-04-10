use anchor_lang::prelude::*;

use crate::Pool;

#[derive(Accounts)]
pub struct Log<'info> {
    #[account(
        seeds = [
            b"pool",
            pool.owner.key().as_ref(),
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
    )]
    pub pool: Box<Account<'info, Pool>>,
}

pub fn log(ctx: Context<Log>, _event: &[u8]) -> Result<()> {
    msg!("Logging event");
    // State account must sign to use this transaction to ensure it's
    // only used by the program for logging.
    if !ctx.accounts.pool.to_account_info().is_signer {
        return Err(ErrorCode::InvalidProgramId.into());
    }
    Ok(())
}
