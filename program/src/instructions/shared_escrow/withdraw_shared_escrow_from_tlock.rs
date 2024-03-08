use anchor_lang::prelude::*;
use std::str::FromStr;
use tensor_toolbox::transfer_lamports_from_pda;

use crate::SharedEscrow;

#[derive(Accounts)]
#[instruction(bump: u8, order_id: [u8; 32])]
pub struct WithdrawSharedEscrowCpiTLock<'info> {
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

    // this order state can only be derived from TLOCK program for a given owner
    // and because it's a signer only TLOCK can call this
    // Don't want to import tlock package just because of the key, so hardcoding
    #[account(
        seeds=[b"order_state".as_ref(), owner.key().as_ref(), order_id.as_ref()],
        seeds::program = Pubkey::from_str("TLoCKic2wGJm7VhZKumih4Lc35fUhYqVMgA4j389Buk").unwrap(),
        bump = bump,
    )]
    pub order_state: Signer<'info>,

    /// CHECK: has_one on shared_escrow, seeds in order_state
    pub owner: UncheckedAccount<'info>,

    /// CHECK: can only be passed in by TLOCK, since it has to sign off with order pda
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_withdraw_shared_escrow_from_tlock(
    ctx: Context<WithdrawSharedEscrowCpiTLock>,
    lamports: u64,
) -> Result<()> {
    transfer_lamports_from_pda(
        &ctx.accounts.shared_escrow.to_account_info(),
        &ctx.accounts.destination.to_account_info(),
        lamports,
    )
}
