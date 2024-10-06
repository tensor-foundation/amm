pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

declare_id!("TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg");

/// Program entrypoint
#[program]
pub mod amm_program {
    use super::*;

    //-------------------------------//
    // admin instructions            //
    //-------------------------------//

    /// Self-cpi logging instruction; can only be called internally by the program itself.
    pub fn tamm_noop(ctx: Context<TAmmNoop>, _event: TAmmEvent) -> Result<()> {
        noop::process_noop(ctx)
    }

    //-------------------------------//
    // "standard" instructions       //
    //-------------------------------//

    /// Create a new pool.
    pub fn create_pool(ctx: Context<CreatePool>, args: CreatePoolArgs) -> Result<()> {
        process_create_pool(ctx, args)
    }

    /// Edit an existing pool.
    pub fn edit_pool(ctx: Context<EditPool>, args: EditPoolArgs) -> Result<()> {
        instructions::edit_pool::process_edit_pool(ctx, args)
    }

    /// Close a pool if it has no NFTs and is not attached to a shared escrow.
    pub fn close_pool<'info>(ctx: Context<'_, '_, '_, 'info, ClosePool<'info>>) -> Result<()> {
        instructions::close_pool::process_close_pool(ctx)
    }

    /// Permissionlessly close an expired pool.
    pub fn close_expired_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseExpiredPool<'info>>,
    ) -> Result<()> {
        instructions::close_expired_pool::process_close_expired_pool(ctx)
    }

    /// Deposit SOL into a Token or Trade pool.
    pub fn deposit_sol<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositSol<'info>>,
        lamports: u64,
    ) -> Result<()> {
        instructions::deposit_sol::process_deposit_sol(ctx, lamports)
    }

    /// Withdraw SOL from a Token or Trade pool.
    pub fn withdraw_sol<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawSol<'info>>,
        lamports: u64,
    ) -> Result<()> {
        instructions::withdraw_sol::process_withdraw_sol(ctx, lamports)
    }

    //-------------------------------//
    // Legacy and PNFT instructions  //
    //-------------------------------//

    /// Deposit a Metaplex legacy NFT or pNFT into a NFT or Trade pool.
    pub fn deposit_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNft<'info>>,
        authorization_data: Option<AuthorizationDataLocal>,
    ) -> Result<()> {
        instructions::legacy::deposit_nft::process_deposit_nft(ctx, authorization_data)
    }

    /// Withdraw a Metaplex legacy NFT or pNFT from a NFT or Trade pool.
    pub fn withdraw_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawNft<'info>>,
        authorization_data: Option<AuthorizationDataLocal>,
    ) -> Result<()> {
        instructions::legacy::withdraw_nft::process_withdraw_nft(ctx, authorization_data)
    }

    /// Buy a Metaplex legacy NFT or pNFT from a NFT or Trade pool.
    pub fn buy_nft<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyNft<'info>>,
        max_amount: u64,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::legacy::buy_nft::process_buy_nft(
            ctx,
            max_amount,
            authorization_data,
            optional_royalty_pct,
        )
    }

    /// Sell a Metaplex legacy NFT or pNFT into a Token pool.
    pub fn sell_nft_token_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTokenPool<'info>>,
        min_price: u64,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::legacy::sell_nft_token_pool::process_sell_nft_token_pool(
            ctx,
            min_price,
            authorization_data,
            optional_royalty_pct,
        )
    }

    /// Sell a Metaplex legacy NFT or pNFT into a Trade pool.
    pub fn sell_nft_trade_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
        min_price: u64,
        authorization_data: Option<AuthorizationDataLocal>,
        optional_royalty_pct: Option<u16>,
    ) -> Result<()> {
        instructions::legacy::sell_nft_trade_pool::process_sell_nft_trade_pool(
            ctx,
            min_price,
            authorization_data,
            optional_royalty_pct,
        )
    }

    //-------------------------------//
    // MPL Core instructions         //
    //-------------------------------//

    /// Deposit a Token22 NFT into a NFT or Trade pool.
    pub fn deposit_nft_core<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNftCore<'info>>,
    ) -> Result<()> {
        instructions::mplx_core::process_deposit_nft_core(ctx)
    }

    /// Withdraw a Token22 NFT from a NFT or Trade pool.
    pub fn withdraw_nft_core<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawNftCore<'info>>,
    ) -> Result<()> {
        instructions::mplx_core::process_withdraw_nft_core(ctx)
    }

    /// Buy a Token22 NFT from a NFT or Trade pool.
    pub fn buy_nft_core<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyNftCore<'info>>,
        max_amount: u64,
    ) -> Result<()> {
        instructions::mplx_core::process_buy_nft_core(ctx, max_amount)
    }

    /// Sell a Token22 NFT into a Token pool.
    pub fn sell_nft_token_pool_core<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolCore<'info>>,
        min_price: u64,
    ) -> Result<()> {
        instructions::mplx_core::sell_nft_token_pool::process_sell_nft_token_pool_core(
            ctx, min_price,
        )
    }

    /// Sell a Token22 NFT into a Trade pool.
    pub fn sell_nft_trade_pool_core<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTradePoolCore<'info>>,
        min_price: u64,
    ) -> Result<()> {
        instructions::mplx_core::process_sell_nft_trade_pool_core(ctx, min_price)
    }

    //-------------------------------//
    // Token 2022 instructions       //
    //-------------------------------//

    /// Deposit a Token22 NFT into a NFT or Trade pool.
    pub fn deposit_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositNftT22<'info>>,
    ) -> Result<()> {
        instructions::process_deposit_nft_t22(ctx)
    }

    /// Withdraw a Token22 NFT from a NFT or Trade pool.
    pub fn withdraw_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawNftT22<'info>>,
    ) -> Result<()> {
        instructions::process_withdraw_nft_t22(ctx)
    }

    /// Buy a Token22 NFT from a NFT or Trade pool.
    pub fn buy_nft_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyNftT22<'info>>,
        max_amount: u64,
    ) -> Result<()> {
        instructions::process_buy_nft_t22(ctx, max_amount)
    }

    /// Sell a Token22 NFT into a Token pool.
    pub fn sell_nft_token_pool_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
        min_price: u64,
    ) -> Result<()> {
        instructions::process_sell_nft_token_pool_t22(ctx, min_price)
    }

    /// Sell a Token22 NFT into a Trade pool.
    pub fn sell_nft_trade_pool_t22<'info>(
        ctx: Context<'_, '_, '_, 'info, SellNftTradePoolT22<'info>>,
        min_price: u64,
    ) -> Result<()> {
        instructions::process_sell_nft_trade_pool_t22(ctx, min_price)
    }
}
