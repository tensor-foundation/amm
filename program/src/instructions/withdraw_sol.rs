//! Withdraw SOL from a Trade or Token pool.
use constants::CURRENT_POOL_VERSION;
use tensor_toolbox::transfer_lamports;
use tensor_vipers::{throw_err, unwrap_int};

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    /// The owner of the pool and will receive the SOL.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool from which the SOL will be withdrawn.
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
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

/// Withdraw SOL from a Token or Trade pool.
pub fn process_withdraw_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    lamports: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    let rent = solana_program::rent::Rent::get()?;
    let pool_min_rent = rent.minimum_balance(Pool::SIZE);

    let current_pool_lamports = pool.to_account_info().get_lamports();

    // The pool must maintain the minimum rent balance. To close the pool, use "close_pool", which
    // performs appropriate checks.
    if current_pool_lamports
        .checked_sub(lamports)
        .ok_or(ErrorCode::ArithmeticError)?
        < pool_min_rent
    {
        throw_err!(ErrorCode::PoolInsufficientRent);
    }

    // Update the pool's currency amount
    if pool.currency == Pubkey::default() {
        pool.amount = unwrap_int!(pool.amount.checked_sub(lamports));
    }

    transfer_lamports(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
        lamports,
    )
}
