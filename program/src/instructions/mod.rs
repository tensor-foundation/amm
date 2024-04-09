pub mod admin;
pub mod buy_nft;
pub mod close_pool;
pub mod create_pool;
pub mod deposit_nft;
pub mod deposit_sol;
pub mod edit_pool;
pub mod sell_nft_token_pool;
pub mod sell_nft_trade_pool;
pub mod shared_escrow;
pub mod t22_buy_nft;
pub mod t22_deposit_nft;
pub mod t22_sell_nft_token_pool;
pub mod t22_sell_nft_trade_pool;
pub mod t22_withdraw_nft;
pub mod withdraw_mm_fees;
pub mod withdraw_nft;
pub mod withdraw_sol;

pub use admin::*;
pub use buy_nft::*;
pub use close_pool::*;
pub use create_pool::*;
pub use deposit_nft::*;
pub use deposit_sol::*;
pub use edit_pool::*;
pub use sell_nft_token_pool::*;
pub use sell_nft_trade_pool::*;
pub use shared_escrow::*;
pub use single_listing::*;
pub use t22_buy_nft::*;
pub use t22_deposit_nft::*;
pub use t22_sell_nft_token_pool::*;
pub use t22_sell_nft_trade_pool::*;
pub use t22_withdraw_nft::*;
pub use withdraw_mm_fees::*;
pub use withdraw_nft::*;
pub use withdraw_sol::*;

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use mpl_token_metadata::{self};
use solana_program::pubkey;
use tensor_whitelist::{self, MintProof, MintProofV2, Whitelist, WhitelistV2};
use vipers::{throw_err, unwrap_checked};

use crate::constants::{HUNDRED_PCT_BPS, MAKER_REBATE_BPS, TAKER_BROKER_PCT, TSWAP_TAKER_FEE_BPS};
use crate::{error::ErrorCode, *};

pub static MPL_TOKEN_AUTH_RULES_ID: Pubkey = pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

pub fn shared_escrow_pda(owner: &Pubkey, nr: u16) -> (Pubkey, u8) {
    let program_id = &crate::id();
    Pubkey::find_program_address(
        &[b"shared_escrow".as_ref(), owner.as_ref(), &nr.to_le_bytes()],
        program_id,
    )
}

#[inline(never)]
pub fn assert_decode_shared_escrow_account<'info>(
    shared_escrow_account_info: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
) -> Result<Box<SharedEscrow>> {
    let mut data: &[u8] = &shared_escrow_account_info.try_borrow_data()?;
    let shared_escrow_account: Box<SharedEscrow> =
        Box::new(AccountDeserialize::try_deserialize(&mut data)?);

    let program_id = &crate::id();
    let (key, _) = shared_escrow_pda(&owner.key(), shared_escrow_account.nr);
    if key != *shared_escrow_account_info.key {
        throw_err!(ErrorCode::BadSharedEscrow);
    }
    // Check program owner (redundant because of find_program_address above, but why not).
    if *shared_escrow_account_info.owner != *program_id {
        throw_err!(ErrorCode::BadSharedEscrow);
    }
    // Check normal owner (not redundant - this actually checks if the account is initialized and stores the owner correctly).
    if shared_escrow_account.owner != owner.key() {
        throw_err!(ErrorCode::BadSharedEscrow);
    }

    Ok(shared_escrow_account)
}

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
#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct SellNftShared<'info> {
    //degenerate: fee_acc now === TSwap, keeping around to preserve backwards compatibility
    /// CHECK: has_one = fee_vault in tswap
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
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
#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct SellNftSharedT22<'info> {
    //degenerate: fee_acc now === TSwap, keeping around to preserve backwards compatibility
    /// CHECK: has_one = fee_vault in tswap
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
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

pub fn get_tswap_addr() -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(&[], &crate::id());
    pda
}
