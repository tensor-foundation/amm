pub mod admin;
pub mod buy_nft;
pub mod close_expired_pool;
pub mod close_pool;
pub mod create_pool;
pub mod deposit_nft;
pub mod deposit_sol;
pub mod edit_pool;
pub mod sell_nft_token_pool;
pub mod sell_nft_trade_pool;
pub mod t22_buy_nft;
pub mod t22_deposit_nft;
pub mod t22_sell_nft_token_pool;
pub mod t22_sell_nft_trade_pool;
pub mod t22_withdraw_nft;
pub mod withdraw_nft;
pub mod withdraw_sol;

pub use admin::*;
pub use buy_nft::*;
pub use close_expired_pool::*;
pub use close_pool::*;
pub use create_pool::*;
pub use deposit_nft::*;
pub use deposit_sol::*;
pub use edit_pool::*;
pub use sell_nft_token_pool::*;
pub use sell_nft_trade_pool::*;
use spl_token_metadata_interface::borsh::BorshDeserialize;
pub use t22_buy_nft::*;
pub use t22_deposit_nft::*;
pub use t22_sell_nft_token_pool::*;
pub use t22_sell_nft_trade_pool::*;
pub use t22_withdraw_nft::*;
pub use withdraw_nft::*;
pub use withdraw_sol::*;

use crate::constants::{HUNDRED_PCT_BPS, TAKER_FEE_BPS};
use crate::{error::ErrorCode, *};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use escrow_program::instructions::assert_decode_margin_account;
use mpl_token_metadata::{self};
use solana_program::pubkey;
use tensor_toolbox::shard_num;
use tensor_whitelist::{self, MintProof, MintProofV2, Whitelist, WhitelistV2};
use vipers::{throw_err, unwrap_checked, unwrap_int};

use self::constants::{BROKER_FEE_PCT, TFEE_PROGRAM_ID};

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
        &tensor_whitelist::ID,
    );
    if key != *mint_proof.key {
        throw_err!(ErrorCode::BadMintProof);
    }
    // Check program owner (redundant because of find_program_address above, but why not).
    if *mint_proof.owner != tensor_whitelist::ID {
        throw_err!(ErrorCode::BadMintProof);
    }

    let mut data: &[u8] = &mint_proof.try_borrow_data()?;
    let mint_proof: Box<MintProof> = Box::new(AccountDeserialize::try_deserialize(&mut data)?);
    Ok(mint_proof)
}

#[inline(never)]
pub fn assert_decode_mint_proof_v2(
    whitelist: &Account<WhitelistV2>,
    nft_mint: &InterfaceAccount<Mint>,
    mint_proof: &UncheckedAccount,
) -> Result<Box<MintProofV2>> {
    let (key, _) = Pubkey::find_program_address(
        &[
            b"mint_proof".as_ref(),
            nft_mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        &tensor_whitelist::ID,
    );
    if key != *mint_proof.key {
        throw_err!(ErrorCode::BadMintProof);
    }
    // Check program owner (redundant because of find_program_address above, but why not).
    if *mint_proof.owner != tensor_whitelist::ID {
        throw_err!(ErrorCode::BadMintProof);
    }

    let mut data: &[u8] = &mint_proof.try_borrow_data()?;
    let mint_proof: Box<MintProofV2> = Box::new(AccountDeserialize::try_deserialize(&mut data)?);
    Ok(mint_proof)
}

/// Shared accounts between the two sell ixs.
/// Currently unused until Kinobi support.
#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct SellNftShared<'info> {
    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the mint as the fee shard number
            shard_num!(mint),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist @ ErrorCode::WrongAuthority,
        // Why close the pool??
        close = owner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, Whitelist>>,

    /// intentionally not deserializing, it would be dummy in the case of VOC/FVC based verification
    /// CHECK: seeds below + assert_decode_mint_proof
    #[account(
        seeds = [
            b"mint_proof".as_ref(),
            mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub mint_proof: UncheckedAccount<'info>,

    #[account(mut, token::mint = mint, token::authority = seller)]
    pub nft_seller_acc: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: whitelist, token::mint in nft_seller_acc, associated_token::mint in owner_ata_acc
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    //can't deserialize directly coz Anchor traits not implemented
    /// CHECK: assert_decode_metadata + seeds below
    #[account(mut,
        seeds=[
            mpl_token_metadata::accounts::Metadata::PREFIX,
            mpl_token_metadata::ID.as_ref(),
            mint.key().as_ref(),
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: has_one = owner in pool (owner is the buyer)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

/// Shared accounts between the two sell T22 ixs.
/// Currently unused until Kinobi support.
#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct SellNftSharedT22<'info> {
    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the mint as the fee shard number
            shard_num!(nft_mint),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist @ ErrorCode::WrongAuthority,
        close = owner,
    )]
    pub pool: Box<Account<'info, Pool>>,
    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, Whitelist>>,

    /// intentionally not deserializing, it would be dummy in the case of VOC/FVC based verification
    /// CHECK: seeds below + assert_decode_mint_proof
    #[account(
        seeds = [
            b"mint_proof".as_ref(),
            nft_mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub mint_proof: UncheckedAccount<'info>,

    #[account(mut, token::mint = nft_mint, token::authority = seller)]
    pub nft_seller_acc: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: whitelist, token::mint in nft_seller_acc, associated_token::mint in owner_ata_acc
    pub nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: has_one = owner in pool (owner is the buyer)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

/// Currently unused until Kinobi support.
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
    pub taker_fee: u64,
    pub tamm_fee: u64,
    pub maker_broker_fee: u64,
    pub taker_broker_fee: u64,
}

pub fn calc_taker_fees(amount: u64, maker_broker_pct: u8) -> Result<Fees> {
    // Taker fee: protocol and broker fees.
    let taker_fee = unwrap_checked!({
        (TAKER_FEE_BPS as u64)
            .checked_mul(amount)?
            .checked_div(HUNDRED_PCT_BPS as u64)
    });

    // Broker fees are a percentage of the taker fee.
    let broker_fees = unwrap_checked!({
        (BROKER_FEE_PCT as u64)
            .checked_mul(taker_fee)?
            .checked_div(100u64)
    });

    // The protocol is the remainder of the taker fee.
    let tamm_fee = unwrap_int!(taker_fee.checked_sub(broker_fees));

    // Maker broker fee calculated as a percentage of the total brokers fee.
    let maker_broker_fee = unwrap_checked!({
        (maker_broker_pct as u64)
            .checked_mul(broker_fees)?
            .checked_div(100u64)
    });

    // Remaining broker fee is the taker broker fee.
    let taker_broker_fee = unwrap_int!(broker_fees.checked_sub(maker_broker_fee));

    Ok(Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    })
}
