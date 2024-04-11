use anchor_lang::prelude::*;
use vipers::{throw_err, Validate};

use crate::{constants::CURRENT_POOL_VERSION, error::ErrorCode, Pool, PoolConfig, POOL_SIZE};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct ReallocPool<'info> {
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        realloc = POOL_SIZE,
        realloc::payer = cosigner,
        realloc::zero = false,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: used in seed derivation - NOT A SIGNER, COZ WE'RE MIGRATING ON THEIR BEHALF
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub cosigner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for ReallocPool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPool);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_realloc_pool(ctx: Context<ReallocPool>) -> Result<()> {
    Ok(())
}
