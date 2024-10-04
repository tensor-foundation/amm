//! Sell a Mpl Core NFT into a Token pool.
//!
//! This is separated from Trade pool since the owner will receive the NFT directly.
use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct SellNftTokenPoolCore<'info> {
    pub core: MplCoreShared<'info>,

    pub trade: TradeShared<'info>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> Deref for SellNftTokenPoolCore<'info> {
    type Target = MplCoreShared<'info>;

    fn deref(&self) -> &Self::Target {
        &self.core
    }
}

impl<'info> DerefMut for SellNftTokenPoolCore<'info> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.core
    }
}

impl<'info> Validate<'info> for SellNftTokenPoolCore<'info> {
    fn validate(&self) -> Result<()> {
        // Must be a token pool
        require!(
            self.trade.pool.config.pool_type == PoolType::Token,
            ErrorCode::WrongPoolType
        );

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

        match self.trade.pool.config.pool_type {
            PoolType::Token => (),
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
        if self.trade.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }

        self.trade.pool.taker_allowed_to_sell()?;

        Ok(())
    }
}

impl<'info> SellNftTokenPoolCore<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let whitelist = unwrap_opt!(self.trade.whitelist.as_ref(), ErrorCode::BadWhitelist);

        validate_asset(
            &self.asset.to_account_info(),
            self.collection
                .as_ref()
                .map(|a| a.to_account_info())
                .as_ref(),
        )?;

        let asset = BaseAssetV1::try_from(self.asset.as_ref())?;

        // Fetch the verified creators from the MPL Core asset and map into the expected type.
        let creators: Option<Vec<Creator>> = fetch_plugin::<BaseAssetV1, VerifiedCreators>(
            &self.asset.to_account_info(),
            PluginType::VerifiedCreators,
        )
        .map(|(_, verified_creators, _)| {
            verified_creators
                .signatures
                .into_iter()
                .map(|c| Creator {
                    address: c.address,
                    share: 0, // No share on VerifiedCreators on MPL Core assets. This is separate from creators used in royalties.
                    verified: c.verified,
                })
                .collect()
        })
        .ok();

        let collection = match asset.update_authority {
            UpdateAuthority::Collection(address) => Some(Collection {
                key: address,
                verified: true, // Only the collection update authority can set a collection, so this is always verified.
            }),
            _ => None,
        };

        let full_merkle_proof = if let Some(mint_proof) = &self.trade.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(whitelist, &self.asset.key(), mint_proof)?;

            let leaf = keccak::hash(self.asset.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(&collection, &creators, &full_merkle_proof)
    }
}

/// Sell a MPL Core NFT into a Token pool.
#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_token_pool_core<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolCore<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let pool_initial_balance = ctx.accounts.trade.pool.get_lamports();
    {
        let pool = &ctx.accounts.trade.pool;
        let owner_pubkey = ctx.accounts.trade.owner.key();

        // Calculate fees from the current price.
        let current_price = pool.current_price(TakerSide::Sell)?;

        let Fees {
            taker_fee,
            tamm_fee,
            maker_broker_fee,
            taker_broker_fee,
        } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

        // No mm_fee for token pools.

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
            mm_fee: 0, // no MM fee for token pool
            creators_fee,
        });

        // Self-CPI log the event before price check for easier debugging.
        record_event(
            event,
            &ctx.accounts.trade.amm_program,
            &ctx.accounts.trade.pool,
        )?;

        // Check that the total price the seller receives isn't lower than the min price the user specified.
        let price = unwrap_checked!({ current_price.checked_sub(creators_fee) });

        if price < min_price {
            throw_err!(ErrorCode::PriceMismatch);
        }

        // Signer seeds for the pool account.
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            owner_pubkey.as_ref(),
            pool.pool_id.as_ref(),
            &[pool.bump[0]],
        ]];

        // Transfer the NFT from the seller directly to the pool owner.
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.asset)
            .authority(Some(&ctx.accounts.trade.taker.to_account_info()))
            .new_owner(&ctx.accounts.trade.owner)
            .payer(&ctx.accounts.trade.taker)
            .collection(ctx.accounts.collection.as_ref().map(|c| c.as_ref()))
            .invoke()?;

        /*  **Transfer Fees**
        The sell price is the total price the seller receives for selling the NFT into the pool.

        sell_price = current_price - taker_fee - creators_fee

        taker_fee = tamm_fee + maker_broker_fee + taker_broker_fee

        No mm_fee for token pools.

        Fees are paid by deducting them from the current price, with the final remainder
        then being sent to the seller.
        */

        // If the source funds are from a shared escrow account, we first transfer from there
        // to the pool, to make payments cleaner. After this, we can always send from the pool
        // so the logic is simpler.
        if pool.shared_escrow != Pubkey::default() {
            let incoming_shared_escrow = unwrap_opt!(
                ctx.accounts.trade.shared_escrow.as_ref(),
                ErrorCode::BadSharedEscrow
            )
            .to_account_info();

            let escrow_program = unwrap_opt!(
                ctx.accounts.trade.escrow_program.as_ref(),
                ErrorCode::EscrowProgramNotSet
            )
            .to_account_info();

            // Validate it's a valid escrow account.
            assert_decode_margin_account(
                &incoming_shared_escrow,
                &ctx.accounts.trade.owner.to_account_info(),
            )?;

            // Validate it's the correct account: the stored escrow account matches the one passed in.
            if incoming_shared_escrow.key != &pool.shared_escrow {
                throw_err!(ErrorCode::BadSharedEscrow);
            }

            // Withdraw from escrow account to pool.
            WithdrawMarginAccountCpiTammCpi {
                __program: &escrow_program,
                margin_account: &incoming_shared_escrow,
                pool: &ctx.accounts.trade.pool.to_account_info(),
                owner: &ctx.accounts.trade.owner.to_account_info(),
                destination: &ctx.accounts.trade.pool.to_account_info(),
                system_program: &ctx.accounts.system_program.to_account_info(),
                __args: WithdrawMarginAccountCpiTammInstructionArgs {
                    bump: pool.bump[0],
                    pool_id: pool.pool_id,
                    lamports: current_price,
                },
            }
            .invoke_signed(signer_seeds)?;
        }

        let mut left_for_seller = current_price;

        // TAmm contract fee.
        transfer_lamports_from_pda(
            &ctx.accounts.trade.pool.to_account_info(),
            &ctx.accounts.trade.fee_vault.to_account_info(),
            tamm_fee,
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(tamm_fee));

        // Broker fees. Transfer if accounts are specified, otherwise the funds go to the fee_vault.
        transfer_lamports_from_pda(
            &ctx.accounts.trade.pool.to_account_info(),
            ctx.accounts
                .trade
                .maker_broker
                .as_ref()
                .unwrap_or(&ctx.accounts.trade.fee_vault),
            maker_broker_fee,
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(maker_broker_fee));

        transfer_lamports_from_pda(
            &ctx.accounts.trade.pool.to_account_info(),
            ctx.accounts
                .trade
                .taker_broker
                .as_ref()
                .unwrap_or(&ctx.accounts.trade.fee_vault),
            taker_broker_fee,
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_broker_fee));

        // Pay creators fee, if required.
        let actual_creators_fee = if let Some(Royalties { creators, .. }) = royalties {
            transfer_creators_fee(
                &creators.into_iter().map(Into::into).collect(),
                &mut ctx.remaining_accounts.iter(),
                creators_fee,
                &CreatorFeeMode::Sol {
                    from: &FromAcc::Pda(&ctx.accounts.trade.pool.to_account_info()),
                },
            )?
        } else {
            0
        };

        // Taker pays royalties, so we subtract them from the amount left for the seller.
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(actual_creators_fee));

        // Token pools do not have MM fees.

        // transfer remainder to seller
        // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
        // (!) maker rebate already taken out of this amount
        transfer_lamports_from_pda(
            &ctx.accounts.trade.pool.to_account_info(),
            &ctx.accounts.trade.taker.to_account_info(),
            left_for_seller,
        )?;
    }

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.trade.pool;

    // Pool has bought an NFT, so we decrement the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_sub(1));

    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    if pool.currency == Pubkey::default() {
        let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
        let pool_final_balance = pool.get_lamports();
        let lamports_taken =
            unwrap_checked!({ pool_initial_balance.checked_sub(pool_final_balance) });
        pool.amount = unwrap_checked!({ pool.amount.checked_sub(lamports_taken) });

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
            ErrorCode::InvalidPoolAmount
        );
    }

    try_autoclose_pool(
        &ctx.accounts.trade.pool,
        ctx.accounts.trade.rent_payer.to_account_info(),
        ctx.accounts.trade.owner.to_account_info(),
    )
}
