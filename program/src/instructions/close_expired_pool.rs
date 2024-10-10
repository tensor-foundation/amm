//! Permissionlessly close an expired pool.
use constants::CURRENT_POOL_VERSION;

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct CloseExpiredPool<'info> {
    /// The rent payer to refund pool rent to.
    /// CHECK: has_one in pool
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// The owner account must be specified and match the account stored in the pool but does not have to sign
    /// for expired pools.
    /// CHECK: seeds in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The pool to close.
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = rent_payer @ ErrorCode::WrongRentPayer,
        constraint = pool.version == CURRENT_POOL_VERSION @ ErrorCode::WrongPoolVersion,
        constraint = pool.nfts_held == 0 @ ErrorCode::ExistingNfts,
        constraint = Clock::get()?.unix_timestamp > pool.expiry @ ErrorCode::PoolNotExpired,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

/// Permissionlessly close an expired pool.
pub fn process_close_expired_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseExpiredPool<'info>>,
) -> Result<()> {
    // Must close manually because cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    state::pool::close_pool(pool, rent_payer_info, ctx.accounts.owner.to_account_info())
}
