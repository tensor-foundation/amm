use anchor_lang::prelude::*;
use tensor_whitelist::{self, Whitelist};
use vipers::{throw_err, try_or_err, Validate};

use crate::{
    constants::{CURRENT_POOL_VERSION, MAX_DELTA_BPS, MAX_MM_FEES_BPS},
    error::ErrorCode,
    state::{Pool, PoolConfig, POOL_SIZE},
    CurveType, PoolStats, PoolType, SolEscrow,
};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct CreatePoolArgs {
    pub identifier: [u8; 32],
    config: PoolConfig,
    cosigner: Option<Pubkey>,
    order_type: u8,
    max_taker_sell_count: Option<u32>,
}

#[derive(Accounts)]
#[instruction(args: CreatePoolArgs)]
pub struct CreatePool<'info> {
    // Signers
    #[account(mut)]
    pub owner: Signer<'info>,

    // PDA accounts
    #[account(
        init,
        payer = owner,
        space = POOL_SIZE,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            args.identifier.as_ref(),
        ],
        bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init, payer = owner,
        seeds = [
            b"sol_escrow".as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        space = 8
    )]
    pub sol_escrow: Box<Account<'info, SolEscrow>>,

    /// Needed for pool seeds derivation / will be stored inside pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, Whitelist>>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreatePool<'info> {
    fn validate_pool_type(&self, config: PoolConfig) -> Result<()> {
        match config.pool_type {
            PoolType::NFT | PoolType::Token => {
                if config.mm_fee_bps.is_some() {
                    throw_err!(ErrorCode::FeesNotAllowed);
                }
            }
            PoolType::Trade => {
                if config.mm_fee_bps.is_none() {
                    throw_err!(ErrorCode::MissingFees);
                }
                if config.mm_fee_bps.unwrap() > MAX_MM_FEES_BPS {
                    throw_err!(ErrorCode::FeesTooHigh);
                }
            }
        }

        //for exponential pool delta can't be above 99.99% and has to fit into a u16
        if config.curve_type == CurveType::Exponential {
            let u16delta = try_or_err!(u16::try_from(config.delta), ErrorCode::ArithmeticError);
            if u16delta > MAX_DELTA_BPS {
                throw_err!(ErrorCode::DeltaTooLarge);
            }
        }

        Ok(())
    }
}

impl<'info> Validate<'info> for CreatePool<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[access_control(ctx.accounts.validate_pool_type(args.config); ctx.accounts.validate())]
pub fn process_create_pool(ctx: Context<CreatePool>, args: CreatePoolArgs) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    if args.config.starting_price < 1 {
        throw_err!(ErrorCode::StartingPriceTooSmall);
    }

    pool.version = CURRENT_POOL_VERSION;
    pool.bump = [ctx.bumps.pool];
    pool.sol_escrow_bump = [ctx.bumps.sol_escrow];
    pool.created_at = Clock::get()?.unix_timestamp;
    pool.config = args.config;

    pool.owner = ctx.accounts.owner.key();
    pool.whitelist = ctx.accounts.whitelist.key();
    pool.sol_escrow = ctx.accounts.sol_escrow.key();

    pool.taker_buy_count = 0;
    pool.taker_sell_count = 0;
    pool.nfts_held = 0;

    pool.stats = PoolStats::default();

    if args.cosigner.is_some() && args.config.pool_type != PoolType::Token {
        throw_err!(ErrorCode::WrongPoolType);
    }
    pool.cosigner = args.cosigner;
    //all pools start off as non-marginated, and can be attached later
    pool.shared_escrow = None;
    pool.updated_at = Clock::get()?.unix_timestamp;

    if let Some(max_taker_sell_count) = args.max_taker_sell_count {
        pool.max_taker_sell_count = max_taker_sell_count;
    }

    Ok(())
}
