use tensor_toolbox::NullableOption;
use vipers::{throw_err, try_or_err, Validate};

use self::constants::{CURRENT_POOL_VERSION, MAX_DELTA_BPS, MAX_MM_FEES_BPS};
use crate::{error::ErrorCode, *};

macro_rules! unwrap_opt_or_return_ok {
    ($expr:expr) => {
        match $expr {
            Some(val) => val,
            None => return Ok(()),
        }
    };
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct EditPoolArgs {
    pub new_config: Option<PoolConfig>,
    pub cosigner: Option<Pubkey>,
    pub expire_in_sec: Option<u64>,
    pub max_taker_sell_count: Option<u32>,
    pub reset_price_offset: bool,
}

/// Edit an existing pool.
#[derive(Accounts)]
#[instruction(args: EditPoolArgs)]
pub struct EditPool<'info> {
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for EditPool<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

impl<'info> EditPool<'info> {
    fn validate_pool_type(&self, new_config: Option<PoolConfig>) -> Result<()> {
        let new_config = unwrap_opt_or_return_ok!(new_config);

        //cannot change pool type
        if self.pool.config.pool_type != new_config.pool_type {
            throw_err!(ErrorCode::WrongPoolType);
        }

        match new_config.pool_type {
            PoolType::NFT | PoolType::Token => {
                if new_config.mm_fee_bps.value().is_some() {
                    throw_err!(ErrorCode::FeesNotAllowed);
                }
            }
            PoolType::Trade => {
                if new_config.mm_fee_bps.value().is_none() {
                    throw_err!(ErrorCode::MissingFees);
                }
                if *new_config.mm_fee_bps.value().unwrap() > MAX_MM_FEES_BPS {
                    throw_err!(ErrorCode::FeesTooHigh);
                }
            }
        }

        //for exponential pool delta can't be above 99.99% and has to fit into a u16
        if new_config.curve_type == CurveType::Exponential {
            let u16delta = try_or_err!(u16::try_from(new_config.delta), ErrorCode::ArithmeticError);
            if u16delta > MAX_DELTA_BPS {
                throw_err!(ErrorCode::DeltaTooLarge);
            }
        }

        Ok(())
    }
}

/// Edit an existing pool.
#[access_control(ctx.accounts.validate(); ctx.accounts.validate_pool_type(args.new_config))]
pub fn process_edit_pool(ctx: Context<EditPool>, args: EditPoolArgs) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    if let Some(new_config) = args.new_config {
        pool.config = new_config;
    }

    if let Some(cosigner) = args.cosigner {
        pool.cosigner = NullableOption::new(cosigner);
    }

    if let Some(max_taker_sell_count) = args.max_taker_sell_count {
        pool.valid_max_sell_count(max_taker_sell_count)?;
        pool.max_taker_sell_count = max_taker_sell_count;
    }

    if args.reset_price_offset {
        pool.price_offset = 0;
    }

    let timestamp = Clock::get()?.unix_timestamp;

    // If the user passes in a new expiry value, set it to that.
    // None, in this case means no change, instead of max value like it does in create_pool.
    if let Some(expire_in_sec) = args.expire_in_sec {
        // Convert the user's u64 seconds offset to i64 for timestamp math.
        let expire_in_i64 = try_or_err!(i64::try_from(expire_in_sec), ErrorCode::ArithmeticError);

        // Ensure the expiry is not too far in the future.
        require!(expire_in_i64 <= MAX_EXPIRY_SEC, ErrorCode::ExpiryTooLarge);

        // Set the expiry to a timestamp equal to the current timestamp plus the user's offset.
        pool.expiry = timestamp
            .checked_add(expire_in_i64)
            .ok_or(ErrorCode::ArithmeticError)?;
    }

    Ok(())
}
