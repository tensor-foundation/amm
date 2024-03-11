//! User withdrawing SOL from their pool (all 3 types)
use tensor_toolbox::transfer_lamports_from_pda;
use tensor_whitelist::Whitelist;
use vipers::throw_err;

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction( config: PoolConfig)]
pub struct WithdrawSol<'info> {
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump = pool.bump[0],
        constraint = config.pool_type == PoolType::Token ||  config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        has_one = owner, has_one = whitelist, has_one = sol_escrow,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: has_one = whitelist in pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, Whitelist>>,

    /// CHECK: has_one = escrow in pool
    #[account(
        mut,
        seeds=[
            b"sol_escrow".as_ref(),
            pool.key().as_ref(),
        ],
        bump = pool.sol_escrow_bump[0],
    )]
    pub sol_escrow: Box<Account<'info, SolEscrow>>,

    /// Tied to the pool because used to verify pool seeds
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawSol<'info> {
    pub fn transfer_lamports(&self, from: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        transfer_lamports_from_pda(from, &self.owner.to_account_info(), lamports)
    }
}

impl<'info> WithdrawSol<'info> {
    fn validate_sol_transfer(&self) -> Result<()> {
        if self.pool.shared_escrow.is_some() {
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

#[access_control(ctx.accounts.validate_sol_transfer())]
pub fn process_withdraw_sol<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    lamports: u64,
) -> Result<()> {
    ctx.accounts
        .transfer_lamports(&ctx.accounts.sol_escrow.to_account_info(), lamports)
}
