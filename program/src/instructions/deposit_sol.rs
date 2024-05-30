//! Deposit SOL into a Token or Trade pool.
use anchor_lang::solana_program::{program::invoke, system_instruction};
use vipers::{throw_err, unwrap_checked, Validate};

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// The owner of the pool--must sign to deposit SOL.
    /// CHECK: has_one = owner in pool
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
        has_one = owner,
        // can only deposit SOL into Token/Trade pool
        constraint = pool.config.pool_type == PoolType::Token ||  pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> DepositSol<'info> {
    fn transfer_lamports(&self, lamports: u64) -> Result<()> {
        invoke(
            &system_instruction::transfer(self.owner.key, &self.pool.key(), lamports),
            &[
                self.owner.to_account_info(),
                self.pool.to_account_info(),
                self.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }
}

impl<'info> Validate<'info> for DepositSol<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.shared_escrow.value().is_some() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }
}

/// Allows a pool owner to deposit SOL into a Token or Trade pool.
#[access_control(ctx.accounts.validate())]
pub fn process_deposit_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
    lamports: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Update the pool's currency amount
    if pool.currency.is_sol() {
        pool.amount = unwrap_checked!({ pool.amount.checked_add(lamports) });
    }

    ctx.accounts.transfer_lamports(lamports)
}
