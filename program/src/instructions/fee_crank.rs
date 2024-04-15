use std::iter::zip;

use anchor_lang::prelude::*;
use solana_program::{program::invoke_signed, system_instruction};

use crate::{error::ErrorCode, FDN_TREASURY, FEE_KEEP_ALIVE_LAMPORTS};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct FeeSeeds {
    pub index: u8,
    pub bump: u8,
}

/// Permissionless fee crank that collects fees from fee vault accounts and sends them
/// to the Tensor Foundation treasury.
#[derive(Accounts)]
pub struct FeeCrank<'info> {
    /// Fee destination account
    /// CHECK: This is hard-coded to the Tensor Foundation's treasury account.
    #[account(
        mut,
        address = FDN_TREASURY,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    // n fee accounts in remaining accounts
    // where the accounts are derived from the passed in
    // indices and bumps, in order
}

pub fn process_fee_crank<'info>(
    ctx: Context<'_, '_, '_, 'info, FeeCrank<'info>>,
    seeds: &[FeeSeeds],
) -> Result<()> {
    let treasury = &ctx.accounts.treasury.to_account_info();
    let treasury_pubkey = treasury.key();

    let fee_accounts = ctx.remaining_accounts;

    if seeds.len() != fee_accounts.len() {
        return Err(ErrorCode::InvalidFeeCrank.into());
    }

    msg!("Received {} fee accounts", fee_accounts.len());

    // Iterate over fee accounts and passed in seeds and collect fees
    for (account, fee_seeds) in zip(fee_accounts, seeds) {
        // Collect fees
        let index = fee_seeds.index.to_le_bytes();
        let bump = fee_seeds.bump.to_be_bytes();

        let signers_seeds: &[&[&[u8]]] = &[&[b"fee_vault", &index, &bump]];

        let lamports = account
            .lamports()
            .checked_sub(FEE_KEEP_ALIVE_LAMPORTS)
            .ok_or(ErrorCode::ArithmeticError)?;

        msg!(
            "Collecting {} lamports from account {}",
            lamports,
            account.key()
        );

        // Fee account is a "ghost PDA"--owned by the system program, so requires a system transfer.
        invoke_signed(
            &system_instruction::transfer(&account.key(), &treasury_pubkey, lamports),
            &[account.clone(), treasury.clone()],
            signers_seeds,
        )?;
    }

    Ok(())
}
