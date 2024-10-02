//! Close a pool if it has no NFTs and is not attached to a shared escrow.
use tensor_vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct ClosePool<'info> {
    /// The rent payer to refund pool rent to.
    /// CHECK: handler logic checks that it's the same as the stored rent payer
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
        has_one = owner @ ErrorCode::BadOwner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
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
