use tensor_toolbox::{close_account, transfer_lamports, transfer_lamports_checked};

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftCore<'info> {
    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// Trade shared accounts.
    pub trade: TradeShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            core.asset.key().as_ref(),
            trade.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // Check the receipt is for the correct pool and asset.
        constraint = nft_receipt.mint == core.asset.key() && nft_receipt.pool == trade.pool.key() @ ErrorCode::WrongMint,
        constraint = trade.pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> BuyNftCore<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.trade.validate_buy()
    }
}

/// Buy a MPL Core asset from a NFT or Trade pool.
#[access_control(ctx.accounts.pre_process_checks())]
pub fn process_buy_nft_core<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNftCore<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let pool = &ctx.accounts.trade.pool;
    let pool_initial_balance = pool.get_lamports();

    let owner = ctx.accounts.trade.owner.to_account_info();
    let owner_pubkey = ctx.accounts.trade.owner.key();

    let taker = ctx.accounts.trade.taker.to_account_info();
    let fee_vault = ctx.accounts.trade.fee_vault.to_account_info();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Buy)?;

    // Protocol and broker fees.
    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    // This resolves to 0 for NFT pools.
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // Validate asset account and determine if royalites need to be paid.
    let royalties = validate_asset(
        &ctx.accounts.core.asset.to_account_info(),
        ctx.accounts
            .core
            .collection
            .as_ref()
            .map(|a| a.to_account_info())
            .as_ref(),
    )?;

    let royalty_fee = if let Some(Royalties { basis_points, .. }) = royalties {
        basis_points
    } else {
        0
    };

    // No optional royalties.
    let creators_fee = calc_creators_fee(royalty_fee, current_price, None, Some(100))?;

    // For keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee,
    });

    // Self-CPI log the event.
    record_event(
        event,
        &ctx.accounts.trade.amm_program,
        &ctx.accounts.trade.pool,
    )?;

    // Check that the  price + royalties + mm_fee doesn't exceed the max amount the user specified to prevent sandwich attacks.
    let price = unwrap_checked!({ current_price.checked_add(mm_fee)?.checked_add(creators_fee) });

    // Check slippage including fees.
    if price > max_amount {
        throw_err!(ErrorCode::PriceMismatch);
    }

    // Transfer the NFT from the pool to the buyer.

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&ctx.accounts.trade.pool.to_account_info()))
        .new_owner(&ctx.accounts.trade.taker)
        .payer(&ctx.accounts.trade.taker)
        .collection(ctx.accounts.core.collection.as_ref().map(|c| c.as_ref()))
        .invoke_signed(signer_seeds)?;

    /*  **Transfer Fees**
    The buy price is the total price the buyer pays for buying the NFT from the pool.

    buy_price = current_price + taker_fee + mm_fee + creators_fee

    taker_fee = tamm_fee + broker_fee + maker_rebate

    The mm_fee is the fee paid to the MM for providing liquidity to the pool and only applies to Trade pools.

    Fees are paid by individual transfers as they go to various accounts depending on the pool type
    and configuration.
    */

    // Determine the SOL destination: owner, pool or shared escrow account.
    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        //send money direct to seller/owner
        PoolType::NFT => ctx.accounts.trade.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => {
            if pool.shared_escrow != Pubkey::default() {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.trade.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(&incoming_shared_escrow, &owner)?;

                if incoming_shared_escrow.key != &pool.shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                incoming_shared_escrow
            } else {
                ctx.accounts.trade.pool.to_account_info()
            }
        }
        PoolType::Token => unreachable!(),
    };

    // Buyer pays the taker fee: tamm_fee + maker_broker_fee + taker_broker_fee.
    transfer_lamports(&taker, &fee_vault, tamm_fee)?;

    transfer_lamports_checked(
        &taker,
        ctx.accounts
            .trade
            .maker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&fee_vault),
        maker_broker_fee,
    )?;

    transfer_lamports_checked(
        &taker,
        ctx.accounts
            .trade
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&fee_vault),
        taker_broker_fee,
    )?;

    // Pay creator royalties.
    if let Some(Royalties { creators, .. }) = royalties {
        transfer_creators_fee(
            &creators.into_iter().map(Into::into).collect(),
            &mut ctx.remaining_accounts.iter(),
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::External(&FromExternal {
                    from: &taker,
                    sys_prog: &ctx.accounts.system_program,
                }),
            },
        )?;
    }

    // Price always goes to the destination: NFT pool --> owner, Trade pool --> either the pool or the escrow account.
    transfer_lamports(&taker, &destination, current_price)?;

    // Trade pools need to check compounding fees
    if matches!(pool.config.pool_type, PoolType::Trade) {
        // If MM fees are compounded they go to the destination to remain
        // in the pool or escrow.
        if pool.config.mm_compound_fees {
            transfer_lamports(&taker, &destination, mm_fee)?;
        } else {
            // If MM fees are not compounded they go to the owner.
            transfer_lamports(&taker, &owner, mm_fee)?;
        }
    }

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.trade.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Pool has sold an NFT, so we increment the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_add(1));

    pool.stats.taker_buy_count = unwrap_int!(pool.stats.taker_buy_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    //record the entirety of MM fee during the buy tx
    if pool.config.pool_type == PoolType::Trade {
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    // No currency support yet, only SOL.
    if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
        let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
        let pool_final_balance = pool.get_lamports();
        let lamports_added =
            unwrap_checked!({ pool_final_balance.checked_sub(pool_initial_balance) });
        pool.amount = unwrap_checked!({ pool.amount.checked_add(lamports_added) });

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
            ErrorCode::InvalidPoolAmount
        );
    }

    // Close the NFT receipt account.
    close_account(
        &mut ctx.accounts.nft_receipt.to_account_info(),
        &mut ctx.accounts.trade.owner.to_account_info(),
    )?;

    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        ctx.accounts.trade.owner.to_account_info(),
    )
}
