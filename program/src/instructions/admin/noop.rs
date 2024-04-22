use anchor_lang::{
    prelude::*,
    solana_program::{hash, instruction::Instruction, program::invoke_signed},
};

use crate::{Pool, TAmmEvent};

#[derive(Accounts)]
pub struct TAmmNoop<'info> {
    #[account(
        seeds = [
            b"pool",
            pool.owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
    )]
    pub pool: Box<Account<'info, Pool>>,
}

pub fn process_noop(ctx: Context<TAmmNoop>) -> Result<()> {
    msg!("Logging event");
    // State account must sign to use this transaction to ensure it's
    // only used by the program for logging.
    if !ctx.accounts.pool.to_account_info().is_signer {
        return Err(ErrorCode::InvalidProgramId.into());
    }
    Ok(())
}

pub(crate) fn record_event<'info>(
    event: TAmmEvent,
    tamm: &Program<'info, crate::program::AmmProgram>,
    pool: &Account<'info, Pool>,
) -> Result<()> {
    let mut data = Vec::new();
    data.extend_from_slice(&hash::hash("global:tamm_noop".as_bytes()).to_bytes()[..8]);
    data.extend_from_slice(&event.try_to_vec()?);

    let pool_meta = AccountMeta {
        pubkey: pool.key(),
        is_signer: true,
        is_writable: false,
    };

    invoke_signed(
        &Instruction {
            program_id: tamm.key(),
            accounts: vec![pool_meta],
            data,
        },
        &[pool.to_account_info()],
        &[&pool.seeds()],
    )?;

    Ok(())
}
