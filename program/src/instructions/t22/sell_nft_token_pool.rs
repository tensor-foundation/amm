//! Sell a Token22 NFT into a Token pool.
//!
//! This is separated from Trade pool since the owner will receive the NFT directly in their ATA.

use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct SellNftTokenPoolT22<'info> {
    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    pub t22: T22Shared<'info>,

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

impl<'info> SellNftTokenPoolT22<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_sell(&PoolType::Token)?;
        self.trade
            .verify_whitelist(&self.t22, Some(self.mint.to_account_info()))
    }
}

/// Sell a Token22 NFT into a Token pool.
pub fn process_sell_nft_token_pool_t22<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
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

    // transfer the NFT
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.taker_ta.to_account_info(),
            to: ctx.accounts.owner_ta.to_account_info(),
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

    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        ctx.accounts.trade.owner.to_account_info(),
    )
}
