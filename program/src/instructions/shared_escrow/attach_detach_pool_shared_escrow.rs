use anchor_lang::prelude::*;
use tensor_toolbox::{transfer_lamports_from_pda, NullableOption};
use vipers::{throw_err, unwrap_int, Validate};

use crate::{
    constants::CURRENT_POOL_VERSION, error::ErrorCode, Pool, PoolType, SharedEscrow, POOL_SIZE,
};

#[derive(Accounts)]
pub struct AttachDetachPoolSharedEscrow<'info> {
    #[account(
        mut,
        seeds = [
            b"shared_escrow".as_ref(),
            owner.key().as_ref(),
            &shared_escrow.nr.to_le_bytes()
        ],
        bump = shared_escrow.bump[0],
        has_one = owner,
    )]
    pub shared_escrow: Box<Account<'info, SharedEscrow>>,

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        // can only deposit SOL into Token pool
        constraint = pool.config.pool_type == PoolType::Token || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for AttachDetachPoolSharedEscrow<'info> {
    fn validate(&self) -> Result<()> {
        //bids only for now
        match self.pool.config.pool_type {
            PoolType::Token => (),
            PoolType::Trade => (),
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

impl<'info> AttachDetachPoolSharedEscrow<'info> {
    fn empty_escrow(&self) -> Result<()> {
        // We need to leave enough state bond to keep the pool alive.
        let rent = solana_program::rent::Rent::get()?;
        let pool_keep_alive = rent.minimum_balance(POOL_SIZE);

        let current_pool_lamports = self.pool.to_account_info().get_lamports();

        let withdraw_lamports = current_pool_lamports
            .checked_sub(pool_keep_alive)
            .ok_or(ErrorCode::ArithmeticError)?;

        transfer_lamports_from_pda(
            &self.pool.to_account_info(),
            &self.shared_escrow.to_account_info(),
            withdraw_lamports,
        )
    }
    fn move_to_escrow(&self, lamports: u64) -> Result<()> {
        transfer_lamports_from_pda(
            &self.shared_escrow.to_account_info(),
            &self.pool.to_account_info(),
            lamports,
        )
    }
}

#[access_control(ctx.accounts.validate())]
pub fn attach_handler(ctx: Context<AttachDetachPoolSharedEscrow>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Already attached.
    if pool.shared_escrow.value().is_some() {
        throw_err!(ErrorCode::PoolOnSharedEscrow);
    }

    //if needed adjust max taker sell count
    pool.adjust_pool_max_taker_sell_count()?;

    //move balance to shared_escrow
    ctx.accounts.empty_escrow()?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.shared_escrow = NullableOption::new(ctx.accounts.shared_escrow.key());

    //update shared_escrow
    let shared_escrow = &mut ctx.accounts.shared_escrow;
    shared_escrow.pools_attached = unwrap_int!(shared_escrow.pools_attached.checked_add(1));

    Ok(())
}

#[access_control(ctx.accounts.validate())]
pub fn detach_handler(ctx: Context<AttachDetachPoolSharedEscrow>, lamports: u64) -> Result<()> {
    // Already detached.
    if ctx.accounts.pool.shared_escrow.value().is_none() {
        throw_err!(ErrorCode::PoolNotOnSharedEscrow);
    }
    // Wrong shared escrow.
    if ctx.accounts.shared_escrow.key() != *ctx.accounts.pool.shared_escrow.value().unwrap() {
        throw_err!(ErrorCode::BadSharedEscrow);
    }

    //move balance from shared_escrow to pool
    ctx.accounts.move_to_escrow(lamports)?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.shared_escrow = NullableOption::none();

    //update shared_escrow
    let shared_escrow = &mut ctx.accounts.shared_escrow;
    shared_escrow.pools_attached = unwrap_int!(shared_escrow.pools_attached.checked_sub(1));

    Ok(())
}
