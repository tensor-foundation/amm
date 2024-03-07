pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

declare_id!("TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA");

#[program]
pub mod amm_program {

    use super::*;

    //-------------------------------//
    // admin instructions            //
    //-------------------------------//

    // pub fn init_update_tswap(ctx: Context<InitUpdateTSwap>, config: TSwapConfig) -> Result<()> {
    //     instructions::admin::init_update_tswap::process_init_update_tswap(ctx, config)
    // }

    pub fn realloc_pool(ctx: Context<ReallocPool>, _config: PoolConfig) -> Result<()> {
        instructions::admin::realloc_pool::process_realloc_pool(ctx)
    }

    // pub fn withdraw_tswap_fees(ctx: Context<WithdrawTswapFees>, amount: u64) -> Result<()> {
    //     instructions::admin::withdraw_tswap_fees::process_withdraw_tswap_fees(ctx, amount)
    // }

    //-------------------------------//
    // "standard" instructions       //
    //-------------------------------//

    pub fn create_pool(ctx: Context<CreatePool>, args: CreatePoolArgs) -> Result<()> {
        process_create_pool(ctx, args)
    }

    pub fn close_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>,
        _config: PoolConfig,
    ) -> Result<()> {
        instructions::close_pool::process_close_pool(ctx)
    }
}
