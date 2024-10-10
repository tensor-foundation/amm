//! Deposit SOL into a Token or Trade pool.
use constants::CURRENT_POOL_VERSION;
use tensor_toolbox::transfer_lamports;
use tensor_vipers::unwrap_int;

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// The owner of the pool--must sign to deposit SOL.
    /// CHECK: seeds in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool to deposit the SOL into.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        constraint = pool.version == CURRENT_POOL_VERSION @ ErrorCode::WrongPoolVersion,
        constraint = pool.config.pool_type == PoolType::Token ||  pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.shared_escrow == Pubkey::default() @ ErrorCode::PoolOnSharedEscrow,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

/// Allows a pool owner to deposit SOL into a Token or Trade pool.
pub fn process_deposit_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
    lamports: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Update the pool's currency amount
    if pool.currency == Pubkey::default() {
        pool.amount = unwrap_int!(pool.amount.checked_add(lamports));
    }

    transfer_lamports(
        &ctx.accounts.owner.to_account_info(),
        &ctx.accounts.pool.to_account_info(),
        lamports,
    )
}
