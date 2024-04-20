pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

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

    pub fn tamm_noop(ctx: Context<TAmmNoop>, _event: TAmmEvent) -> Result<()> {
        noop::process_noop(ctx)
    }

    pub fn realloc_pool(ctx: Context<ReallocPool>, _config: PoolConfig) -> Result<()> {
        instructions::admin::realloc_pool::process_realloc_pool(ctx)
    }

    //-------------------------------//
    // "standard" instructions       //
    //-------------------------------//

    pub fn create_pool(ctx: Context<CreatePool>, args: CreatePoolArgs) -> Result<()> {
        process_create_pool(ctx, args)
    }

    pub fn edit_pool(ctx: Context<EditPool>, args: EditPoolArgs) -> Result<()> {
        instructions::edit_pool::process_edit_pool(ctx, args)
    }

    pub fn close_pool<'info>(ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
        instructions::close_pool::process_close_pool(ctx)
    }

    pub fn close_expired_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseExpiredPool<'info>>,
    ) -> Result<()> {
        instructions::close_expired_pool::process_close_expired_pool(ctx)
    }

    pub fn deposit_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>,
        authorization_data: Option<AuthorizationDataLocal>,
    ) -> Result<()> {
        instructions::deposit_nft::process_deposit_nft(ctx, authorization_data)
    }

    pub fn fee_crank<'info>(
        ctx: Context<'_, '_, '_, 'info, FeeCrank<'info>>,
        fee_seeds: Vec<FeeSeeds>,
    ) -> Result<()> {
        instructions::fee_crank::process_fee_crank(ctx, &fee_seeds)
    }

    pub fn withdraw_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawNft<'info>>,
        authorization_data: Option<AuthorizationDataLocal>,
        rules_acc_present: bool,
    ) -> Result<()> {
        instructions::withdraw_nft::process_withdraw_nft(ctx, authorization_data, rules_acc_present)
    }

    pub fn deposit_sol<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
        lamports: u64,
    ) -> Result<()> {
        instructions::deposit_sol::process_deposit_sol(ctx, lamports)
    }

    pub fn withdraw_sol<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
        lamports: u64,
    ) -> Result<()> {
        instructions::withdraw_sol::process_withdraw_sol(ctx, lamports)
    }

    pub fn buy_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyNft<'info>>,
        max_price: u64,
        rules_acc_present: bool,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::buy_nft::process_buy_nft(
            ctx,
            max_price,
            rules_acc_present,
            authorization_data,
            optional_royalty_pct,
        )
    }

    pub fn sell_nft_token_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTokenPool<'info>>,
        min_price: u64,
        rules_acc_present: bool,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::sell_nft_token_pool::process_sell_nft_token_pool(
            ctx,
            min_price,
            rules_acc_present,
            authorization_data,
            optional_royalty_pct,
        )
    }

    pub fn sell_nft_trade_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
        min_price: u64,
        rules_acc_present: bool,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::sell_nft_trade_pool::process_sell_nft_trade_pool(
            ctx,
            min_price,
            rules_acc_present,
            authorization_data,
            optional_royalty_pct,
        )
    }

    pub fn withdraw_mm_fee<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
        lamports: u64,
    ) -> Result<()> {
        instructions::withdraw_mm_fees::process_withdraw_mm_fees(ctx, lamports)
    }

    //-------------------------------//
    // Token 2022 instructions       //
    //-------------------------------//

    pub fn buy_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyNftT22<'info>>,
        _config: PoolConfig,
        max_price: u64,
    ) -> Result<()> {
        instructions::t22_buy_nft::process_t22_buy_nft(ctx, max_price)
    }

    pub fn deposit_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNftT22<'info>>,
        _config: PoolConfig,
    ) -> Result<()> {
        instructions::t22_deposit_nft::process_t22_deposit_nft(ctx)
    }

    pub fn sell_nft_token_pool_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
        _config: PoolConfig,
        min_price: u64,
    ) -> Result<()> {
        instructions::t22_sell_nft_token_pool::process_t22_sell_nft_token_pool(ctx, min_price)
    }

    pub fn sell_nft_trade_pool_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTradePoolT22<'info>>,
        _config: PoolConfig,
        min_price: u64,
    ) -> Result<()> {
        instructions::t22_sell_nft_trade_pool::process_sell_nft_trade_pool(ctx, min_price)
    }

    pub fn withdraw_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawNftT22<'info>>,
        _config: PoolConfig,
    ) -> Result<()> {
        instructions::t22_withdraw_nft::process_t22_withdraw_nft(ctx)
    }
}
