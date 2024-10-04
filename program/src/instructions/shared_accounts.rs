use anchor_lang::prelude::*;
use program::AmmProgram;
use tensor_toolbox::{escrow, shard_num};
use whitelist_program::WhitelistV2;

use crate::{error::ErrorCode, *};

use super::constants::TFEE_PROGRAM_ID;

/* AMM Protocol shared account structs*/

/// Shared accounts for transfer instructions: deposit & withdraw
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TransferShared<'info> {
    /// The owner of the pool and the NFT.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool the asset is being transferred to/from.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::BadOwner,
        // can only trasnfer to/from NFT & Trade pools
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::BadWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,
}

/// Shared accounts for trade instructions: buy & sell
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TradeShared<'info> {
    /// The owner of the pool and the buyer/recipient of the NFT.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The seller is the owner of the NFT who is selling the NFT into the pool.
    #[account(mut)]
    pub taker: Signer<'info>,

    /// The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
    /// is auto-closed.
    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// Fee vault account owned by the TFEE program.
    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the pool as the fee shard number
            shard_num!(pool),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    /// The Pool state account that the NFT is being sold into. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any active pool can be specified provided it is a Token type and the NFT passes at least one
    /// whitelist condition.
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::BadOwner,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        constraint = maker_broker.as_ref().map(|c| c.key()).unwrap_or_default() == pool.maker_broker @ ErrorCode::WrongMakerBroker,
        constraint = cosigner.as_ref().map(|c| c.key()).unwrap_or_default() == pool.cosigner @ ErrorCode::BadCosigner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist account that the pool uses to verify the NFTs being sold into it.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::BadWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The shared escrow account for pools that have liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Constraint checked on pool.
    #[account(mut)]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// CHECK: Constraint checked on pool.
    pub cosigner: Option<Signer<'info>>,

    /// The AMM program account, used for self-cpi logging.
    pub amm_program: Program<'info, AmmProgram>,

    /// The escrow program account for shared liquidity pools.
    /// CHECK: address constraint is checked here
    #[account(address = escrow::ID)]
    pub escrow_program: Option<UncheckedAccount<'info>>,
}

/* Shared account structs for different standards */

/// Shared accounts for interacting with Metaplex legacy and pNFTs.
#[derive(Accounts)]
pub struct MplxShared<'info> {
    /// The Token Metadata metadata account of the NFT.
    /// CHECK: ownership, structure and mint are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    // /// Either the legacy token program or token-2022.
    // pub token_program: Interface<'info, TokenInterface>,
    // /// The SPL associated token program.
    // pub associated_token_program: Program<'info, AssociatedToken>,
    // /// The Solana system program.
    // pub system_program: Program<'info, System>,

    // --------------------------------------- pNft
    /// The Token Metadata edition account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    pub edition: UncheckedAccount<'info>,

    // Todo: add ProgNftShared back in, if possible
    // pub pnft_shared: ProgNftShared<'info>,
    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,
}

/// Additional accounts for Metaplex legacy & pNFT trade instructions
#[derive(Accounts)]
pub struct MplxTradeShared<'info> {
    /// The Token Metadata source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub taker_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the pool.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,
}

/// Additional accounts for Metaplex legacy & pNFT transfer instructions
#[derive(Accounts)]
pub struct MplxTransferShared<'info> {
    /// The Token Metadata source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the destination.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,
}

/// Shared accounts for interacting with Metaplex core assets
#[derive(Accounts)]
pub struct MplCoreShared<'info> {
    /// The MPL core asset account.
    /// CHECK: validated on instruction handler
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: validated on instruction handler
    pub collection: Option<UncheckedAccount<'info>>,

    /// The MPL Core program.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}
