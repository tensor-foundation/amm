//! Close a pool if it has no NFTs and is not attached to a shared escrow.
use constants::CURRENT_POOL_VERSION;

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct ClosePool<'info> {
    /// The rent payer to refund pool rent to.
    /// CHECK: has_one in pool
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// The owner must sign to close the pool.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

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
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

/// Allows the owner to close a pool if it has no NFTs.
pub fn process_close_pool<'info>(ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
    // Must close manually because we cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    state::pool::close_pool(pool, rent_payer_info, ctx.accounts.owner.to_account_info())
}
