//! User depositing SOL into their Token/Trade pool (to purchase NFTs)
use anchor_lang::solana_program::{program::invoke, system_instruction};
use tensor_whitelist::WhitelistV2;
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

/// Allows a pool owner to deposit SOL into a Token or Trade pool.
#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist,
        // can only deposit SOL into Token/Trade pool
        constraint = pool.config.pool_type == PoolType::Token ||  pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: has_one = whitelist in pool
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

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
        if self.pool.shared_escrow.is_some() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_deposit_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
    lamports: u64,
) -> Result<()> {
    ctx.accounts.transfer_lamports(lamports)
}
