//! User (owner) closing their pool and reclaims rent (+ SOL escrow)
use tensor_toolbox::transfer_lamports_from_pda;
use vipers::{throw_err, unwrap_int, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct ClosePool<'info> {
    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

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

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for ClosePool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.nfts_held > 0 {
            throw_err!(ErrorCode::ExistingNfts);
        }

        //can't close a shared_escrow pool, need to detach first
        //this is needed because we need to reduce the counter on the escrow acc to be able to close it later
        if self.pool.shared_escrow.value().is_some() {
            throw_err!(ErrorCode::PoolOnSharedEscrow);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_close_pool<'info>(ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
    // Must close manually because we cannot do this logic in the accounts macro.

    let pool = &ctx.accounts.pool;
    let rent_payer_info = ctx.accounts.rent_payer.to_account_info();

    // The incoming rent payer account must match what's stored on the pool.
    if *rent_payer_info.key != pool.rent_payer {
        throw_err!(ErrorCode::WrongRentPayer);
    }

    let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
    let pool_lamports = pool.get_lamports();

    // Any SOL above the minimum rent/state bond goes to the owner.
    if pool_lamports > pool_state_bond {
        let owner_amount = unwrap_int!(pool_lamports.checked_sub(pool_state_bond));
        transfer_lamports_from_pda(
            &pool.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            owner_amount,
        )?;
    }

    // Rent goes back to the rent payer.
    pool.close(ctx.accounts.rent_payer.to_account_info())?;

    Ok(())
}
