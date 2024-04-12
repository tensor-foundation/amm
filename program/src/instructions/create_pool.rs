use anchor_lang::prelude::*;
use tensor_whitelist::{self, WhitelistV2};
use vipers::{throw_err, try_or_err, Validate};

use crate::{
    constants::{CURRENT_POOL_VERSION, MAX_DELTA_BPS, MAX_MM_FEES_BPS},
    error::ErrorCode,
    state::{Pool, PoolConfig, POOL_SIZE},
    CurveType, PoolStats, PoolType, MAX_EXPIRY_SEC,
};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct CreatePoolArgs {
    pub pool_id: [u8; 32],
    // Here to support future SPL mints, contract enforces this is the native mint currently
    pub currency_mint: Pubkey,
    pub config: PoolConfig,
    pub cosigner: Option<Pubkey>,
    pub order_type: u8,
    pub max_taker_sell_count: Option<u32>,
    pub expire_in_sec: Option<u64>,
}

#[derive(Accounts)]
#[instruction(args: CreatePoolArgs)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub owner: Signer<'info>,

    // PDA accounts
    #[account(
        init,
        payer = rent_payer,
        space = POOL_SIZE,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            args.pool_id.as_ref(),
        ],
        bump
    )]
    pub pool: Account<'info, Pool>,

    /// Needed for pool seeds derivation / will be stored inside pool
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

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
    pool.config = args.config;

    pool.owner = ctx.accounts.owner.key();
    pool.whitelist = ctx.accounts.whitelist.key();
    pool.pool_id = args.pool_id;
    // Refactor for nullable pubkey, just store rent payer directly without checking
    pool.rent_payer = if ctx.accounts.rent_payer.key() == ctx.accounts.owner.key() {
        None
    } else {
        Some(ctx.accounts.rent_payer.key())
    };
    // Only SOL currently supported
    pool.currency = Pubkey::default();
    pool.amount = 0;

    pool.taker_buy_count = 0;
    pool.taker_sell_count = 0;
    pool.nfts_held = 0;

    pool.stats = PoolStats::default();

    pool.cosigner = args.cosigner;
    //all pools start off without a shared escrow, and can be attached later
    pool.shared_escrow = None;

    let timestamp = Clock::get()?.unix_timestamp;

    let expiry = match args.expire_in_sec {
        Some(expire_in_sec) => {
            // Convert the user's u64 seconds offset to i64 for timestamp math.
            let expire_in_i64 =
                try_or_err!(i64::try_from(expire_in_sec), ErrorCode::ArithmeticError);
            // Ensure the expiry is not too far in the future.
            require!(expire_in_i64 <= MAX_EXPIRY_SEC, ErrorCode::ExpiryTooLarge);

            // Set the expiry to a timestamp equal to the current timestamp plus the user's offset.
            timestamp
                .checked_add(expire_in_i64)
                .ok_or(ErrorCode::ArithmeticError)?
        }
        // No expiry provided, set to the maximum allowed value.
        None => timestamp
            .checked_add(MAX_EXPIRY_SEC)
            .ok_or(ErrorCode::ArithmeticError)?,
    };

    pool.created_at = timestamp;
    pool.updated_at = timestamp;
    pool.expiry = expiry;

    if let Some(max_taker_sell_count) = args.max_taker_sell_count {
        pool.max_taker_sell_count = max_taker_sell_count;
    }

    Ok(())
}
