//! Create a new pool.
use anchor_lang::prelude::*;
use escrow_program::state::MarginAccount;
use tensor_vipers::throw_err;
use whitelist_program::{self, WhitelistV2};

use crate::{
    constants::CURRENT_POOL_VERSION,
    error::ErrorCode,
    state::{Pool, PoolConfig},
    PoolStats, PoolType, MAX_EXPIRY_SEC,
};

use super::assert_expiry;

/// Create pool arguments.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct CreatePoolArgs {
    pub pool_id: [u8; 32],
    pub config: PoolConfig,
    // Here to support future SPL mints, contract enforces this is the native mint currently
    pub currency: Option<Pubkey>,
    pub cosigner: Option<Pubkey>,
    pub maker_broker: Option<Pubkey>,
    pub max_taker_sell_count: Option<u32>,
    pub expire_in_sec: Option<u64>,
}

/// Instruction accounts.
#[derive(Accounts)]
#[instruction(args: CreatePoolArgs)]
pub struct CreatePool<'info> {
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    pub owner: Signer<'info>,

    /// The pool state account.
    #[account(
        init,
        payer = rent_payer,
        space = Pool::SIZE,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            args.pool_id.as_ref(),
        ],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    #[account(
        has_one = owner @ ErrorCode::WrongOwner,
        constraint = pool.config.pool_type != PoolType::NFT @ ErrorCode::CannotUseSharedEscrow,
    )]
    pub shared_escrow: Option<Account<'info, MarginAccount>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePool<'info> {
    fn validate(&self, config: PoolConfig) -> Result<()> {
        config.validate()
    }
}

/// Create a new pool.
#[access_control(ctx.accounts.validate(args.config))]
pub fn process_create_pool(ctx: Context<CreatePool>, args: CreatePoolArgs) -> Result<()> {
    if args.config.starting_price < 1 {
        throw_err!(ErrorCode::StartingPriceTooSmall);
    }

    let timestamp = Clock::get()?.unix_timestamp;

    let expiry = assert_expiry(args.expire_in_sec.unwrap_or(MAX_EXPIRY_SEC as u64))?;

    **ctx.accounts.pool.as_mut() = Pool {
        version: CURRENT_POOL_VERSION,
        bump: [ctx.bumps.pool],
        pool_id: args.pool_id,
        created_at: timestamp,
        updated_at: timestamp,
        expiry,
        owner: ctx.accounts.owner.key(),
        whitelist: ctx.accounts.whitelist.key(),
        rent_payer: ctx.accounts.rent_payer.key(),
        currency: Pubkey::default(),
        amount: 0,
        price_offset: 0,
        nfts_held: 0,
        stats: PoolStats::default(),
        shared_escrow: ctx
            .accounts
            .shared_escrow
            .clone()
            .map(|a| a.key())
            .unwrap_or_default(),
        cosigner: args.cosigner.unwrap_or_default(),
        maker_broker: args.maker_broker.unwrap_or_default(),
        max_taker_sell_count: args.max_taker_sell_count.unwrap_or(0),
        config: args.config,
        _reserved: [0; 100],
    };

    Ok(())
}
