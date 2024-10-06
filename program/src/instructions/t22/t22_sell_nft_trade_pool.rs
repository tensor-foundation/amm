//! Sell a Token 2022 NFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
//! owner of the NFT.
//!
//! The seller is the owner of the NFT and receives the pool's current price in return.
//! This is separated from Token pool since the NFT will go into an NFT escrow w/ a receipt.
// (!) Keep common logic in sync with sell_nft_token_pool.rs.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, Token2022, TokenAccount, TransferChecked},
};
use tensor_toolbox::{token_2022::transfer::transfer_checked, TCreator};

use crate::{error::ErrorCode, *};

/// Instruction accounts
#[derive(Accounts)]
pub struct SellNftTradePoolT22<'info> {
    /// T22 shared accounts.
    pub t22: T22<'info>,

    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = trade.taker,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == taker_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == owner_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account of the NFT for the seller's wallet.
    #[account(
        mut,
        token::mint = mint,
        token::authority = trade.taker,
        token::token_program = token_program,
    )]
    pub taker_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be transferred to.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mint,
        associated_token::authority = trade.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[account(
        init_if_needed,
        payer = trade.taker,
        associated_token::mint = mint,
        associated_token::authority = trade.owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Token 2022 program.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> SellNftTradePoolT22<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_sell(&PoolType::Trade)?;
        self.trade
            .verify_whitelist(&self.t22, Some(self.mint.to_account_info()))
    }
}

/// Sell a Token22 NFT into a Trade pool.
pub fn process_sell_nft_trade_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    let asset = ctx
        .accounts
        .t22
        .validate_asset(Some(ctx.accounts.mint.to_account_info()))?;

    let fees = ctx.accounts.trade.calculate_fees(
        asset.seller_fee_basis_points,
        min_price,
        TakerSide::Sell,
        Some(100),
    )?;

    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();

    // Transfer the NFT
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.taker_ta.to_account_info(),
            to: ctx.accounts.pool_ta.to_account_info(),
            authority: ctx.accounts.trade.taker.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    // this will only add the remaining accounts required by a transfer hook if we
    // recognize the hook as a royalty one
    let creator_accounts = if let Some(ref creators) = asset.royalty_creators {
        // add remaining accounts to the transfer cpi
        transfer_cpi = transfer_cpi.with_remaining_accounts(ctx.remaining_accounts.to_vec());

        let mut creator_infos = Vec::with_capacity(creators.len());

        // filter out the creators accounts; the transfer will fail if there
        // are missing creator accounts – i.e., the creator is on the `creator_data`
        // but the account is not in the `creator_infos`
        creators.iter().for_each(|c| {
            let creator = TCreator {
                address: c.address,
                share: c.share,
                verified: c.verified,
            };

            if let Some(account) = ctx
                .remaining_accounts
                .iter()
                .find(|account| &creator.address == account.key)
            {
                creator_infos.push(account.clone());
            }
        });

        creator_infos
    } else {
        vec![]
    };

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // Close seller ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.trade.close_taker_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.taker_ta.to_account_info(),
    ))?;

    ctx.accounts
        .trade
        .pay_seller_fees(asset, fees, &creator_accounts)?;

    update_pool_accounting(
        &mut ctx.accounts.trade.pool,
        pool_initial_balance,
        TakerSide::Sell,
    )?;

    //create nft receipt for trade pool
    let receipt_state = &mut ctx.accounts.nft_receipt;
    receipt_state.bump = ctx.bumps.nft_receipt;
    receipt_state.mint = ctx.accounts.mint.key();
    receipt_state.pool = ctx.accounts.trade.pool.key();

    Ok(())
}
