//! Program instruction handlers.
pub mod admin;
pub mod close_expired_pool;
pub mod close_pool;
pub mod create_pool;
pub mod deposit_sol;
pub mod edit_pool;
pub mod legacy;
pub mod mplx_core;
pub mod shared_accounts;
pub mod t22;
pub mod withdraw_sol;

pub use admin::*;
use anchor_spl::token::Mint;
pub use close_expired_pool::*;
pub use close_pool::*;
pub use create_pool::*;
pub use deposit_sol::*;
pub use edit_pool::*;
pub use legacy::*;
pub use mplx_core::*;
pub use shared_accounts::*;
pub use t22::*;
pub use withdraw_sol::*;

use crate::{error::ErrorCode, *};
use anchor_lang::prelude::*;
use solana_program::pubkey;
use tensor_vipers::throw_err;
use whitelist_program::{self, MintProof, MintProofV2, Whitelist, WhitelistV2};

pub static MPL_TOKEN_AUTH_RULES_ID: Pubkey = pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

#[inline(never)]
pub fn assert_decode_mint_proof(
    whitelist: &Account<Whitelist>,
    nft_mint: &InterfaceAccount<Mint>,
    mint_proof: &UncheckedAccount,
) -> Result<Box<MintProof>> {
    let (key, _) = Pubkey::find_program_address(
        &[
            b"mint_proof".as_ref(),
            nft_mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        &whitelist_program::ID,
    );
    if key != *mint_proof.key {
        throw_err!(ErrorCode::BadMintProof);
    }
    // Check program owner (redundant because of find_program_address above, but why not).
    if *mint_proof.owner != whitelist_program::ID {
        throw_err!(ErrorCode::BadMintProof);
    }

    let mut data: &[u8] = &mint_proof.try_borrow_data()?;
    let mint_proof: Box<MintProof> = Box::new(AccountDeserialize::try_deserialize(&mut data)?);
    Ok(mint_proof)
}

#[inline(never)]
pub fn assert_decode_mint_proof_v2(
    whitelist: &Account<WhitelistV2>,
    nft_mint: &Pubkey,
    mint_proof: &UncheckedAccount,
) -> Result<Box<MintProofV2>> {
    let (key, _) = Pubkey::find_program_address(
        &[
            b"mint_proof_v2",
            nft_mint.as_ref(),
            whitelist.key().as_ref(),
        ],
        &whitelist_program::ID,
    );
    if key != *mint_proof.key {
        throw_err!(ErrorCode::BadMintProof);
    }
    // Check program owner (redundant because of find_program_address above, but why not).
    if *mint_proof.owner != whitelist_program::ID {
        throw_err!(ErrorCode::BadMintProof);
    }

    let mut data: &[u8] = &mint_proof.try_borrow_data()?;
    let mint_proof: Box<MintProofV2> = Box::new(AccountDeserialize::try_deserialize(&mut data)?);
    Ok(mint_proof)
}

pub struct Fees {
    pub taker_fee: u64,
    pub tamm_fee: u64,
    pub maker_broker_fee: u64,
    pub taker_broker_fee: u64,
    pub creators_fee: u64,
}

pub struct AmmFees {
    pub taker_fee: u64,
    pub tamm_fee: u64,
    pub maker_broker_fee: u64,
    pub taker_broker_fee: u64,
}
