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

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct EditPool<'info> {
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut)]
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
                if new_config.mm_fee_bps.is_some() {
                    throw_err!(ErrorCode::FeesNotAllowed);
                }
            }
            PoolType::Trade => {
                if new_config.mm_fee_bps.is_none() {
                    throw_err!(ErrorCode::MissingFees);
                }
                if new_config.mm_fee_bps.unwrap() > MAX_MM_FEES_BPS {
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

#[access_control(ctx.accounts.validate(); ctx.accounts.validate_pool_type(new_config))]
pub fn process_edit_pool(
    ctx: Context<EditPool>,
    new_config: Option<PoolConfig>,
    cosigner: Option<Pubkey>,
    max_taker_sell_count: Option<u32>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    if let Some(new_config) = new_config {
        pool.config = new_config;
    }

    // TODO: get clarification on the comment below this line.
    //need to be able to adjust this boolean when broad order <--> narrow (trait specific)
    if let Some(cosigner) = cosigner {
        //currently bids only
        if pool.config.pool_type != PoolType::Token {
            throw_err!(ErrorCode::WrongPoolType);
        }
        // TODO?: if we want the owner to be able to set the cosigner to None
        // we can change this to a toggle type.
        pool.cosigner = Some(cosigner);
    }

    if let Some(max_taker_sell_count) = max_taker_sell_count {
        pool.valid_max_sell_count(max_taker_sell_count)?;
        pool.max_taker_sell_count = max_taker_sell_count;
    }

    Ok(())
}
