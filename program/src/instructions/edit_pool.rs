//! Edit an existing pool.
use tensor_vipers::throw_err;

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

/// Edit pool arguments.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct EditPoolArgs {
    pub new_config: Option<PoolConfig>,
    pub cosigner: Option<Pubkey>,
    pub expire_in_sec: Option<u64>,
    pub max_taker_sell_count: Option<u32>,
    pub reset_price_offset: bool,
}

/// Instruction accounts.
#[derive(Accounts)]
pub struct EditPool<'info> {
    /// The owner of the pool--must sign to edit the pool.
    pub owner: Signer<'info>,

    /// The pool to edit.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        constraint = pool.version == CURRENT_POOL_VERSION @ ErrorCode::WrongPoolVersion,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> EditPool<'info> {
    fn validate_pool_config(&self, new_config: Option<PoolConfig>) -> Result<()> {
        let new_config = match new_config {
            Some(config) => config,
            None => return Ok(()),
        };

        //cannot change pool type
        if self.pool.config.pool_type != new_config.pool_type {
            throw_err!(ErrorCode::WrongPoolType);
        }

        new_config.validate()
    }
}

/// Edit an existing pool.
#[access_control(ctx.accounts.validate_pool_config(args.new_config))]
pub fn process_edit_pool(ctx: Context<EditPool>, args: EditPoolArgs) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    if let Some(new_config) = args.new_config {
        pool.config = new_config;
    }

    if let Some(cosigner) = args.cosigner {
        pool.cosigner = cosigner;
    }

    if let Some(max_taker_sell_count) = args.max_taker_sell_count {
        pool.valid_max_sell_count(max_taker_sell_count)?;
        pool.max_taker_sell_count = max_taker_sell_count;
    }

    if args.reset_price_offset {
        pool.price_offset = 0;
    }

    // If the user passes in a new expiry value, set it to that.
    // None, in this case means no change, instead of max value like it does in create_pool.
    if let Some(expire_in_sec) = args.expire_in_sec {
        // Set the expiry to a timestamp equal to the current timestamp plus the user's offset.
        pool.expiry = assert_expiry(expire_in_sec)?;
    }

    Ok(())
}
