use tensor_toolbox::close_account;

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftCore<'info> {
    pub core: MplCoreShared<'info>,

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

impl<'info> Deref for BuyNftCore<'info> {
    type Target = MplCoreShared<'info>;

    fn deref(&self) -> &Self::Target {
        &self.core
    }
}

impl<'info> DerefMut for BuyNftCore<'info> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.core
    }
}

impl<'info> Validate<'info> for BuyNftCore<'info> {
    fn validate(&self) -> Result<()> {
        // If the pool has a cosigner, the cosigner account must be passed in.
        if self.trade.pool.cosigner != Pubkey::default() {
            require!(self.trade.cosigner.is_some(), ErrorCode::MissingCosigner);
        }

        // If the pool has a maker broker set, the maker broker account must be passed in.
        if self.trade.pool.maker_broker != Pubkey::default() {
            require!(
                self.trade.maker_broker.is_some(),
                ErrorCode::MissingMakerBroker
            );
        }

        if self.trade.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

impl<'info> BuyNftCore<'info> {
    fn transfer_lamports(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        invoke(
            &system_instruction::transfer(self.trade.taker.key, to.key, lamports),
            &[
                self.trade.taker.to_account_info(),
                to.clone(),
                self.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }

    /// transfers lamports, skipping the transfer if not rent exempt
    fn transfer_lamports_min_balance(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        let rent = Rent::get()?.minimum_balance(to.data_len());
        if unwrap_int!(to.lamports().checked_add(lamports)) < rent {
            //skip current creator, we can't pay them
            return Ok(());
        }
        self.transfer_lamports(to, lamports)?;
        Ok(())
    }
}

/// Buy a MPL Core asset from a NFT or Trade pool.
#[access_control(ctx.accounts.validate())]
pub fn process_buy_nft_core<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNftCore<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let pool = &ctx.accounts.trade.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.trade.owner.key();

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
        &ctx.accounts.asset.to_account_info(),
        ctx.accounts
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

    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.asset)
        .authority(Some(&ctx.accounts.trade.pool.to_account_info()))
        .new_owner(&ctx.accounts.trade.taker)
        .payer(&ctx.accounts.trade.taker)
        .collection(ctx.accounts.collection.as_ref().map(|c| c.as_ref()))
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

                assert_decode_margin_account(
                    &incoming_shared_escrow,
                    &ctx.accounts.trade.owner.to_account_info(),
                )?;

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
    ctx.accounts
        .transfer_lamports(&ctx.accounts.trade.fee_vault.to_account_info(), tamm_fee)?;

    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .trade
            .maker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.trade.fee_vault),
        maker_broker_fee,
    )?;

    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .trade
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.trade.fee_vault),
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
                    from: &ctx.accounts.trade.taker.to_account_info(),
                    sys_prog: &ctx.accounts.system_program,
                }),
            },
        )?;
    }

    // Price always goes to the destination: NFT pool --> owner, Trade pool --> either the pool or the escrow account.
    ctx.accounts
        .transfer_lamports(&destination, current_price)?;

    // Trade pools need to check compounding fees
    if matches!(pool.config.pool_type, PoolType::Trade) {
        // If MM fees are compounded they go to the destination to remain
        // in the pool or escrow.
        if pool.config.mm_compound_fees {
            ctx.accounts
                .transfer_lamports(&destination.to_account_info(), mm_fee)?;
        } else {
            // If MM fees are not compounded they go to the owner.
            ctx.accounts
                .transfer_lamports(&ctx.accounts.trade.owner.to_account_info(), mm_fee)?;
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
