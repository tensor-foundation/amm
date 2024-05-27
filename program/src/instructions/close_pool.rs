//! Allows the owner to close a pool if it has no NFTs and is not attached to a shared escrow.
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

/// Allows the owner to close a pool if it has no NFTs and is not attached to a shared escrow.
#[derive(Accounts)]
pub struct ClosePool<'info> {
    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

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
        has_one = owner @ ErrorCode::WrongAuthority,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The system program account.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for ClosePool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.nfts_held > 0 {
            throw_err!(ErrorCode::ExistingNfts);
        }

        Ok(())
    }
}

/// Allows the owner to close a pool if it has no NFTs.
#[access_control(ctx.accounts.validate())]
pub fn process_close_pool<'info>(ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
    // Must close manually because we cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    state::pool::close_pool(pool, rent_payer_info, ctx.accounts.owner.to_account_info())
}
