use anchor_lang::prelude::*;
use std::str::FromStr;
use tensor_toolbox::transfer_lamports_from_pda;

use crate::SharedEscrow;

#[derive(Accounts)]
#[instruction(bump: u8, bid_id: Pubkey)]
pub struct WithdrawSharedEscrowCpiTcomp<'info> {
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

    // this bid state can only be derived from TCOMP program for a given owner
    // and because it's a signer only TCOMP can call this
    // Don't want to import tcomp package just because of the key, so hardcoding
    #[account(
        seeds=[b"bid_state".as_ref(), owner.key().as_ref(), bid_id.as_ref()],
        seeds::program = Pubkey::from_str("TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp").unwrap(),
        bump = bump,
    )]
    pub bid_state: Signer<'info>,

    /// CHECK: has_one on shared_escrow, seeds in bid_state
    pub owner: UncheckedAccount<'info>,

    /// CHECK: can only be passed in by TCOMP, since it has to sign off with bid pda
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_withdraw_shared_escrow_from_tcomp(
    ctx: Context<WithdrawSharedEscrowCpiTcomp>,
    lamports: u64,
) -> Result<()> {
    transfer_lamports_from_pda(
        &ctx.accounts.shared_escrow.to_account_info(),
        &ctx.accounts.destination.to_account_info(),
        lamports,
    )
}
