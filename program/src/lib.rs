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

    pub fn edit_pool(
        ctx: Context<EditPool>,
        new_config: Option<PoolConfig>,
        cosigner: Option<Pubkey>,
        max_taker_sell_count: Option<u32>,
    ) -> Result<()> {
        instructions::edit_pool::process_edit_pool(ctx, new_config, cosigner, max_taker_sell_count)
    }

    pub fn close_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>,
        _config: PoolConfig,
    ) -> Result<()> {
        instructions::close_pool::process_close_pool(ctx)
    }

    // pub fn deposit_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>,
    //     _config: PoolConfig,
    //     authorization_data: Option<AuthorizationDataLocal>,
    //     rules_acc_present: bool,
    // ) -> Result<()> {
    //     instructions::deposit_nft::process_deposit_nft(ctx, authorization_data, rules_acc_present)
    // }

    // pub fn withdraw_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WithdrawNft<'info>>,
    //     _config: PoolConfig,
    //     authorization_data: Option<AuthorizationDataLocal>,
    //     rules_acc_present: bool,
    // ) -> Result<()> {
    //     instructions::withdraw_nft::process_withdraw_nft(ctx, authorization_data, rules_acc_present)
    // }

    // pub fn deposit_sol<'info>(
    //     ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
    //     _config: PoolConfig,
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::deposit_sol::process_deposit_sol(ctx, lamports)
    // }

    // pub fn withdraw_sol<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    //     _config: PoolConfig,
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::withdraw_sol::process_withdraw_sol(ctx, lamports)
    // }

    // pub fn buy_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, BuyNft<'info>>,
    //     _config: PoolConfig,
    //     max_price: u64,
    //     rules_acc_present: bool,
    //     authorization_data: Option<AuthorizationDataLocal>,
    //     optional_royalty_pct: Option<u16>,
    // ) -> Result<()> {
    //     instructions::buy_nft::process_buy_nft(
    //         ctx,
    //         max_price,
    //         rules_acc_present,
    //         authorization_data,
    //         optional_royalty_pct,
    //     )
    // }

    // pub fn sell_nft_token_pool<'info>(
    //     ctx: Context<'_, '_, '_, 'info, SellNftTokenPool<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    //     rules_acc_present: bool,
    //     authorization_data: Option<AuthorizationDataLocal>,
    //     optional_royalty_pct: Option<u16>,
    // ) -> Result<()> {
    //     instructions::sell_nft_token_pool::process_sell_nft_token_pool(
    //         ctx,
    //         min_price,
    //         rules_acc_present,
    //         authorization_data,
    //         optional_royalty_pct,
    //     )
    // }

    // pub fn sell_nft_trade_pool<'info>(
    //     ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    //     rules_acc_present: bool,
    //     authorization_data: Option<AuthorizationDataLocal>,
    //     optional_royalty_pct: Option<u16>,
    // ) -> Result<()> {
    //     instructions::sell_nft_trade_pool::process_sell_nft_trade_pool(
    //         ctx,
    //         min_price,
    //         rules_acc_present,
    //         authorization_data,
    //         optional_royalty_pct,
    //     )
    // }

    pub fn init_margin_account(
        ctx: Context<InitSharedEscrow>,
        margin_nr: u16,
        name: [u8; 32],
    ) -> Result<()> {
        instructions::init_shared_escrow::process_init_shared_escrow(ctx, margin_nr, name)
    }

    pub fn close_margin_account(ctx: Context<CloseSharedEscrow>) -> Result<()> {
        instructions::close_shared_escrow::process_close_shared_escrow(ctx)
    }

    pub fn deposit_margin_account(ctx: Context<DepositSharedEscrow>, lamports: u64) -> Result<()> {
        instructions::deposit_shared_escrow::process_deposit_shared_escrow(ctx, lamports)
    }

    pub fn withdraw_margin_account(
        ctx: Context<WithdrawSharedEscrow>,
        lamports: u64,
    ) -> Result<()> {
        instructions::withdraw_shared_escrow::process_withdraw_shared_escrow(ctx, lamports)
    }

    pub fn attach_pool_to_margin(
        ctx: Context<AttachDetachPoolSharedEscrow>,
        _config: PoolConfig,
    ) -> Result<()> {
        instructions::attach_detach_pool_shared_escrow::attach_handler(ctx)
    }

    pub fn detach_pool_from_margin(
        ctx: Context<AttachDetachPoolSharedEscrow>,
        _config: PoolConfig,
        lamports: u64,
    ) -> Result<()> {
        instructions::attach_detach_pool_shared_escrow::detach_handler(ctx, lamports)
    }

    pub fn list<'info>(
        ctx: Context<'_, '_, '_, 'info, List<'info>>,
        price: u64,
        authorization_data: Option<AuthorizationDataLocal>,
        rules_acc_present: bool,
    ) -> Result<()> {
        instructions::list::process_list(ctx, price, authorization_data, rules_acc_present)
    }

    pub fn delist<'info>(
        ctx: Context<'_, '_, '_, 'info, Delist<'info>>,
        authorization_data: Option<AuthorizationDataLocal>,
        rules_acc_present: bool,
    ) -> Result<()> {
        instructions::delist::process_delist(ctx, authorization_data, rules_acc_present)
    }

    pub fn buy_single_listing<'info>(
        ctx: Context<'_, '_, '_, 'info, BuySingleListing<'info>>,
        max_price: u64,
        rules_acc_present: bool,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::buy_single_listing::process_buy_single_listing(
            ctx,
            max_price,
            rules_acc_present,
            authorization_data,
            optional_royalty_pct,
        )
    }

    pub fn edit_single_listing<'info>(
        ctx: Context<'_, '_, '_, 'info, EditSingleListing<'info>>,
        price: u64,
    ) -> Result<()> {
        instructions::edit_single_listing::process_edit_single_listing(ctx, price)
    }

    // pub fn withdraw_mm_fee<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
    //     _config: PoolConfig,
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::withdraw_mm_fees::process_withdraw_mm_fees(ctx, lamports)
    // }

    // pub fn withdraw_margin_account_cpi(
    //     ctx: Context<WithdrawMarginAccountCpi>,
    //     _bump: u8,
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::withdraw_margin_account_from_tbid::process_withdraw_margin_account_from_tbid(
    //         ctx, lamports,
    //     )
    // }

    // pub fn withdraw_margin_account_cpi_tcomp(
    //     ctx: Context<WithdrawMarginAccountCpiTcomp>,
    //     _bump: u8,
    //     _bid_id: Pubkey,
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::withdraw_margin_account_from_tcomp::process_withdraw_margin_account_from_tcomp(
    //         ctx, lamports,
    //     )
    // }

    // pub fn withdraw_margin_account_cpi_tlock(
    //     ctx: Context<WithdrawMarginAccountCpiTLock>,
    //     _bump: u8,
    //     _order_id: [u8; 32],
    //     lamports: u64,
    // ) -> Result<()> {
    //     instructions::withdraw_margin_account_from_tlock::process_withdraw_margin_account_from_tlock(
    //         ctx, lamports,
    //     )
    // }

    //-------------------------------//
    // Token 2022 instructions       //
    //-------------------------------//

    // pub fn buy_nft_t22<'info>(
    //     ctx: Context<'_, '_, '_, 'info, BuyNftT22<'info>>,
    //     _config: PoolConfig,
    //     max_price: u64,
    // ) -> Result<()> {
    //     instructions::t22_buy_nft::process_t22_buy_nft(ctx, max_price)
    // }

    // pub fn deposit_nft_t22<'info>(
    //     ctx: Context<'_, '_, '_, 'info, DepositNftT22<'info>>,
    //     _config: PoolConfig,
    // ) -> Result<()> {
    //     instructions::t22_deposit_nft::process_t22_deposit_nft(ctx)
    // }

    // pub fn sell_nft_token_pool_t22<'info>(
    //     ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    // ) -> Result<()> {
    //     instructions::t22_sell_nft_token_pool::process_t22_sell_nft_token_pool(ctx, min_price)
    // }

    // pub fn sell_nft_trade_pool_t22<'info>(
    //     ctx: Context<'_, '_, '_, 'info, SellNftTradePoolT22<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    // ) -> Result<()> {
    //     instructions::t22_sell_nft_trade_pool::process_sell_nft_trade_pool(ctx, min_price)
    // }

    // pub fn withdraw_nft_t22<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WithdrawNftT22<'info>>,
    //     _config: PoolConfig,
    // ) -> Result<()> {
    //     instructions::t22_withdraw_nft::process_t22_withdraw_nft(ctx)
    // }

    pub fn buy_single_listing_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, BuySingleListingT22<'info>>,
        max_price: u64,
    ) -> Result<()> {
        instructions::t22_buy_single_listing::process_buy_single_listing_t22(ctx, max_price)
    }

    pub fn list_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, ListT22<'info>>,
        price: u64,
    ) -> Result<()> {
        instructions::t22_list::process_list_t22(ctx, price)
    }

    pub fn delist_t22<'info>(ctx: Context<'_, '_, '_, 'info, DelistT22<'info>>) -> Result<()> {
        instructions::t22_delist::process_delist_t22(ctx)
    }

    //-------------------------------//
    // WNS instructions              //
    //-------------------------------//

    // pub fn wns_buy_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WnsBuyNft<'info>>,
    //     _config: PoolConfig,
    //     max_price: u64,
    // ) -> Result<()> {
    //     instructions::wns_buy_nft::process_wns_buy_nft(ctx, max_price)
    // }

    // pub fn wns_deposit_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WnsDepositNft<'info>>,
    //     _config: PoolConfig,
    // ) -> Result<()> {
    //     instructions::wns_deposit_nft::process_wns_deposit_nft(ctx)
    // }

    // pub fn wns_sell_nft_token_pool<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WnsSellNftTokenPool<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    // ) -> Result<()> {
    //     instructions::wns_sell_nft_token_pool::process_wns_sell_nft_token_pool(ctx, min_price)
    // }

    // pub fn wns_sell_nft_trade_pool<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WnsSellNftTradePool<'info>>,
    //     _config: PoolConfig,
    //     min_price: u64,
    // ) -> Result<()> {
    //     instructions::wns_sell_nft_trade_pool::process_wns_sell_nft_trade_pool(ctx, min_price)
    // }

    // pub fn wns_withdraw_nft<'info>(
    //     ctx: Context<'_, '_, '_, 'info, WnsWithdrawNft<'info>>,
    //     _config: PoolConfig,
    // ) -> Result<()> {
    //     instructions::wns_withdraw_nft::process_wns_withdraw_nft(ctx)
    // }

    pub fn wns_buy_single_listing<'info>(
        ctx: Context<'_, '_, '_, 'info, WnsBuySingleListing<'info>>,
        max_price: u64,
    ) -> Result<()> {
        instructions::wns_buy_single_listing::wns_process_buy_single_listing(ctx, max_price)
    }

    pub fn wns_list<'info>(
        ctx: Context<'_, '_, '_, 'info, WnsList<'info>>,
        price: u64,
    ) -> Result<()> {
        instructions::wns_list::wns_process_list(ctx, price)
    }

    pub fn wns_delist<'info>(ctx: Context<'_, '_, '_, 'info, WnsDelist<'info>>) -> Result<()> {
        instructions::wns_delist::wns_process_delist(ctx)
    }
}
