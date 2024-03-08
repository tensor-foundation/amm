pub mod admin;
pub mod close_pool;
pub mod create_pool;
pub mod edit_pool;
pub mod shared_escrow;
pub mod single_listing;

pub use admin::*;
pub use close_pool::*;
pub use create_pool::*;
pub use edit_pool::*;
pub use shared_escrow::*;
pub use single_listing::*;

use anchor_lang::prelude::*;
use solana_program::pubkey;
use vipers::unwrap_checked;

use crate::constants::{HUNDRED_PCT_BPS, MAKER_REBATE_BPS, TAKER_BROKER_PCT, TSWAP_TAKER_FEE_BPS};

pub static MPL_TOKEN_AUTH_RULES_ID: Pubkey = pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

#[derive(Accounts)]
pub struct ProgNftShared<'info> {
    //can't deserialize directly coz Anchor traits not implemented
    /// CHECK: address below
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    //sysvar ixs don't deserialize in anchor
    /// CHECK: address below
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,

    /// CHECK: address below
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: UncheckedAccount<'info>,
}

pub struct Fees {
    pub tswap_fee: u64,
    pub maker_rebate: u64,
    pub broker_fee: u64,
    pub taker_fee: u64,
}

pub fn calc_fees_rebates(amount: u64) -> Result<Fees> {
    let taker_fee = unwrap_checked!({
        (TSWAP_TAKER_FEE_BPS as u64)
            .checked_mul(amount)?
            .checked_div(HUNDRED_PCT_BPS as u64)
    });

    let maker_rebate = unwrap_checked!({
        (MAKER_REBATE_BPS as u64)
            .checked_mul(amount)?
            .checked_div(HUNDRED_PCT_BPS as u64)
    });

    let rem_fee = unwrap_checked!({ taker_fee.checked_sub(maker_rebate) });
    let broker_fee = unwrap_checked!({ rem_fee.checked_mul(TAKER_BROKER_PCT)?.checked_div(100) });
    let tswap_fee = unwrap_checked!({ rem_fee.checked_sub(broker_fee) });

    Ok(Fees {
        tswap_fee,
        maker_rebate,
        broker_fee,
        taker_fee,
    })
}
