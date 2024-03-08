//! User (owner) closing their pool and reclaims rent (+ SOL escrow)
use tensor_whitelist::Whitelist;
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct ClosePool<'info> {
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist, has_one = sol_escrow @ ErrorCode::WrongAuthority,
        close = owner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: has_one = escrow in pool
    /// (!) if the order is marginated this won't return any funds to the user, since margin isn't auto-closed
    #[account(
        mut,
        seeds=[
            b"sol_escrow".as_ref(),
            pool.key().as_ref(),
        ],
        bump = pool.sol_escrow_bump[0],
        close = owner,
    )]
    pub sol_escrow: Box<Account<'info, SolEscrow>>,

    /// CHECK: has_one = whitelist in pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, Whitelist>>,

    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for ClosePool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.nfts_held > 0 {
            throw_err!(ErrorCode::ExistingNfts);
        }
        //can't close a marginated pool, need to detach first
        //this is needed because we need to reduce the counter on the margin acc to be able to close it later
        if self.pool.shared_escrow.is_some() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }
}

#[access_control(_ctx.accounts.validate())]
pub fn process_close_pool<'info>(_ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
    Ok(())
}
