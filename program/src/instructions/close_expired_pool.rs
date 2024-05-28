use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

/// Permissionlessly close an expired pool.
#[derive(Accounts)]
pub struct CloseExpiredPool<'info> {
    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::WrongAuthority,
        // Must be expired
        constraint = Clock::get()?.unix_timestamp > pool.expiry @ ErrorCode::PoolNotExpired,
    )]
    pub pool: Box<Account<'info, Pool>>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CloseExpiredPool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.nfts_held > 0 {
            throw_err!(ErrorCode::ExistingNfts);
        }

        Ok(())
    }
}

/// Permissionlessly close an expired pool.
#[access_control(ctx.accounts.validate())]
pub fn process_close_expired_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseExpiredPool<'info>>,
) -> Result<()> {
    // Must close manually because cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    state::pool::close_pool(pool, rent_payer_info, ctx.accounts.owner.to_account_info())
}
