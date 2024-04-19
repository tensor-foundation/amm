use vipers::unwrap_checked;

use crate::*;

#[access_control(ctx.accounts.validate_mm_fee_transfer())]
pub fn process_withdraw_mm_fees<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    lamports: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Update the pool's currency amount
    if pool.currency.is_sol() {
        pool.amount = unwrap_checked!({ pool.amount.checked_sub(lamports) });
    }

    ctx.accounts
        .transfer_lamports(&ctx.accounts.pool.to_account_info(), lamports)
}
