use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct CloseExpiredPool<'info> {
    /// CHECK: handler logic checks that it's the same as the stored rent payer
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

        //can't close a shared_escrow pool, need to detach first
        //this is needed because we need to reduce the counter on the escrow acc to be able to close it later
        if self.pool.shared_escrow.is_some() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_close_expired_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseExpiredPool<'info>>,
) -> Result<()> {
    // Must close manually because cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    // If there's a rent payer stored on the pool, the incoming rent payer account must match, otherwise
    // return the funds to the owner.

    //  nullable pubkey will simplify this logic--might be able to move back to the accounts macro
    let recipient = if let Some(rent_payer) = pool.rent_payer.value() {
        if rent_payer != rent_payer_info.key {
            throw_err!(ErrorCode::WrongRentPayer);
        }
        rent_payer_info
    } else {
        ctx.accounts.owner.to_account_info()
    };

    pool.close(recipient)?;

    Ok(())
}
