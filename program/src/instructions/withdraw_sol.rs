//! Withdraw SOL from a Trade or Token pool.
use tensor_toolbox::transfer_lamports_from_pda;
use tensor_vipers::{throw_err, unwrap_checked};

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
        has_one = owner,
        constraint = pool.config.pool_type == PoolType::Token ||  pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawSol<'info> {
    pub fn transfer_lamports(&self, from: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        transfer_lamports_from_pda(from, &self.owner.to_account_info(), lamports)
    }
}

impl<'info> WithdrawSol<'info> {
    fn validate_sol_transfer(&self) -> Result<()> {
        if self.pool.shared_escrow != Pubkey::default() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }

    pub fn validate_mm_fee_transfer(&self) -> Result<()> {
        if self.pool.config.pool_type != PoolType::Trade {
            throw_err!(ErrorCode::WrongPoolType);
        }
        // (!) NOT doing this check so that if they change pool type to compounded, they can still withdraw fees
        // if self.pool.config.mm_compound_fees {
        //     throw_err!(PoolFeesCompounded);
        // }
        Ok(())
    }
}

/// Withdraw SOL from a Token or Trade pool.
#[access_control(ctx.accounts.validate_sol_transfer())]
pub fn process_withdraw_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    lamports: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    let rent = solana_program::rent::Rent::get()?;
    let pool_keep_alive = rent.minimum_balance(POOL_SIZE);

    let current_pool_lamports = pool.to_account_info().get_lamports();

    // The pool must maintain the minimum rent balance. To close the pool, use "close_pool", which
    // performs appropriate checks.
    if current_pool_lamports
        .checked_sub(lamports)
        .ok_or(ErrorCode::ArithmeticError)?
        < pool_keep_alive
    {
        throw_err!(ErrorCode::PoolKeepAlive);
    }

    // Update the pool's currency amount
    if pool.currency == Pubkey::default() {
        pool.amount = unwrap_checked!({ pool.amount.checked_sub(lamports) });
    }

    ctx.accounts
        .transfer_lamports(&ctx.accounts.pool.to_account_info(), lamports)
}
