use anchor_lang::prelude::*;
use tensor_toolbox::{transfer_all_lamports_from_pda, transfer_lamports_from_pda};
use tensor_whitelist::Whitelist;
use vipers::{throw_err, unwrap_int, Validate};

use crate::{
    constants::CURRENT_POOL_VERSION, error::ErrorCode, Pool, PoolConfig, PoolType, SharedEscrow,
    SolEscrow,
};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
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
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist, has_one = sol_escrow,
        // can only deposit SOL into Token pool
        // TODO: if we decide to add Trade pool, need to update sell_nft_to_trade_pool.rs and buy_nft.rs w/ logic related to shared_escrow
        constraint = config.pool_type == PoolType::Token || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Needed for pool seeds derivation / will be stored inside pool
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
        transfer_all_lamports_from_pda(
            &self.sol_escrow.to_account_info(),
            &self.shared_escrow.to_account_info(),
        )
    }
    fn move_to_escrow(&self, lamports: u64) -> Result<()> {
        transfer_lamports_from_pda(
            &self.shared_escrow.to_account_info(),
            &self.sol_escrow.to_account_info(),
            lamports,
        )
    }
}

#[access_control(ctx.accounts.validate())]
pub fn attach_handler(ctx: Context<AttachDetachPoolSharedEscrow>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    if pool.shared_escrow.is_some() {
        throw_err!(ErrorCode::PoolOnSharedEscrow);
    }

    //if needed adjust max taker sell count
    pool.adjust_pool_max_taker_sell_count()?;

    //move balance to shared_escrow
    ctx.accounts.empty_escrow()?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.shared_escrow = Some(ctx.accounts.shared_escrow.key());

    //update shared_escrow
    let shared_escrow = &mut ctx.accounts.shared_escrow;
    shared_escrow.pools_attached = unwrap_int!(shared_escrow.pools_attached.checked_add(1));

    Ok(())
}

#[access_control(ctx.accounts.validate())]
pub fn detach_handler(ctx: Context<AttachDetachPoolSharedEscrow>, lamports: u64) -> Result<()> {
    if ctx.accounts.pool.shared_escrow.is_none() {
        throw_err!(ErrorCode::PoolNotOnSharedEscrow);
    }
    if ctx.accounts.shared_escrow.key() != ctx.accounts.pool.shared_escrow.unwrap() {
        throw_err!(ErrorCode::BadSharedEscrow);
    }

    //move balance from shared_escrow to escrow
    ctx.accounts.move_to_escrow(lamports)?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.shared_escrow = None;

    //update shared_escrow
    let shared_escrow = &mut ctx.accounts.shared_escrow;
    shared_escrow.pools_attached = unwrap_int!(shared_escrow.pools_attached.checked_sub(1));

    Ok(())
}
