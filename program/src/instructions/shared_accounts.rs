use anchor_lang::prelude::*;
use anchor_spl::token_interface::{CloseAccount, Mint};
use constants::CURRENT_POOL_VERSION;
use escrow_program::instructions::assert_decode_margin_account as assert_decode_escrow_account;
use mpl_token_metadata::types::{Collection, Creator};
use program::AmmProgram;
use solana_program::keccak;
use tensor_escrow::instructions::{
    WithdrawMarginAccountCpiTammCpi, WithdrawMarginAccountCpiTammInstructionArgs,
};
use tensor_toolbox::{
    calc_creators_fee, calc_fees, escrow, is_royalty_enforced, shard_num,
    token_2022::validate_mint, token_metadata::assert_decode_metadata, transfer_creators_fee,
    transfer_lamports, transfer_lamports_checked, CalcFeesArgs, CreatorFeeMode, FromAcc,
    FromExternal, BROKER_FEE_PCT, MAKER_BROKER_PCT, TAKER_FEE_BPS,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt};
use whitelist_program::{FullMerkleProof, WhitelistV2};

use super::constants::TFEE_PROGRAM_ID;

use mpl_core::{
    accounts::BaseAssetV1,
    fetch_plugin,
    types::{PluginType, Royalties, UpdateAuthority, VerifiedCreators},
};
use tensor_toolbox::metaplex_core::validate_asset;

use crate::{error::ErrorCode, *};

/* AMM Protocol shared account structs*/

/// Shared accounts for transfer instructions: deposit & withdraw
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TransferShared<'info> {
    /// The owner of the pool and the NFT.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool the NFT is being transferred to/from.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        constraint = pool.version == CURRENT_POOL_VERSION @ ErrorCode::WrongPoolVersion,
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::WrongWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,
}

/// Shared accounts for trade instructions: buy & sell
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TradeShared<'info> {
    /// The owner of the pool and the buyer/recipient of the NFT.
    /// CHECK: seeds in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The taker is the user buying or selling the NFT.
    #[account(mut)]
    pub taker: Signer<'info>,

    /// The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
    /// is auto-closed.
    /// CHECK: has_one in pool
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// Fee vault account owned by the TFEE program.
    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the pool as the fee shard number
            shard_num!(pool),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    /// The Pool state account that the NFT is being sold into. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any active pool can be specified provided it is a Token type and the NFT passes at least one
    /// whitelist condition.
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = rent_payer @ ErrorCode::WrongRentPayer,
        constraint = pool.version == CURRENT_POOL_VERSION @ ErrorCode::WrongPoolVersion,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        constraint = maker_broker.as_ref().map(|c| c.key()).unwrap_or_default() == pool.maker_broker @ ErrorCode::WrongMakerBroker,
        constraint = cosigner.as_ref().map(|c| c.key()).unwrap_or_default() == pool.cosigner @ ErrorCode::WrongCosigner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist account that the pool uses to verify the NFTs being sold into it.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        // NB: this is an optional constraint: if whitelist is required, then it will be checked for existence in handler.
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::WrongWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The shared escrow account for pools that have liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Constraint checked on pool.
    #[account(mut)]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// CHECK: Constraint checked on pool.
    pub cosigner: Option<Signer<'info>>,

    /// The AMM program account, used for self-cpi logging.
    pub amm_program: Program<'info, AmmProgram>,

    /// The escrow program account for shared liquidity pools.
    /// CHECK: address constraint is checked here
    #[account(address = escrow::ID)]
    pub escrow_program: Option<UncheckedAccount<'info>>,

    pub native_program: Program<'info, System>,
}

impl<'info> TradeShared<'info> {
    pub fn validate(&self) -> Result<()> {
        // If the pool has a cosigner, the cosigner account must be passed in.
        if self.pool.cosigner != Pubkey::default() {
            require!(self.cosigner.is_some(), ErrorCode::MissingCosigner);
        }

        // If the pool has a maker broker set, the maker broker account must be passed in.
        if self.pool.maker_broker != Pubkey::default() {
            require!(self.maker_broker.is_some(), ErrorCode::MissingMakerBroker);
        }

        Ok(())
    }
}

impl<'info> TradeShared<'info> {
    pub fn validate_sell(&self, pool_type: &PoolType) -> Result<()> {
        // Ensure correct pool type
        require!(
            self.pool.config.pool_type == *pool_type,
            ErrorCode::WrongPoolType
        );

        self.pool.taker_allowed_to_sell()?;

        self.validate()
    }

    pub fn pay_seller_fees(
        &self,
        amm_asset: AmmAsset,
        fees: Fees,
        remaining_accounts: &[AccountInfo<'info>],
    ) -> Result<()> {
        let Fees {
            taker_fee: _,
            tamm_fee,
            maker_broker_fee,
            taker_broker_fee,
            creators_fee,
        } = fees;

        let pool = &self.pool;
        let owner_pubkey = self.owner.key();
        let current_price = pool.current_price(TakerSide::Sell)?;

        let mm_fee = pool.calc_mm_fee(current_price)?;

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            owner_pubkey.as_ref(),
            pool.pool_id.as_ref(),
            &[pool.bump[0]],
        ]];

        /*  **Transfer Fees**
        The sell price is the total price the seller receives for selling the NFT into the pool.

        sell_price = current_price - taker_fee - creators_fee

        taker_fee = tamm_fee + maker_broker_fee + taker_broker_fee

        No mm_fee for token pools.

        Fees are paid by deducting them from the current price, with the final remainder
        then being sent to the seller.
        */

        // If the source funds are from a shared escrow account, we first transfer from there
        // to the pool, to avoid multiple, expensive CPI calls.
        if pool.shared_escrow != Pubkey::default() {
            let incoming_shared_escrow =
                unwrap_opt!(self.shared_escrow.as_ref(), ErrorCode::BadSharedEscrow)
                    .to_account_info();

            let escrow_program =
                unwrap_opt!(self.escrow_program.as_ref(), ErrorCode::EscrowProgramNotSet)
                    .to_account_info();

            // Validate it's a valid escrow account.
            assert_decode_escrow_account(&incoming_shared_escrow, &self.owner.to_account_info())?;

            // Validate it's the correct account: the stored escrow account matches the one passed in.
            if incoming_shared_escrow.key != &pool.shared_escrow {
                throw_err!(ErrorCode::BadSharedEscrow);
            }

            // Withdraw from escrow account to pool.
            WithdrawMarginAccountCpiTammCpi {
                __program: &escrow_program,
                margin_account: &incoming_shared_escrow,
                pool: &self.pool.to_account_info(),
                owner: &self.owner.to_account_info(),
                destination: &self.pool.to_account_info(),
                system_program: &self.native_program,
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
        transfer_lamports(&self.pool.to_account_info(), &self.fee_vault, tamm_fee)?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(tamm_fee));

        // Broker fees. Transfer if accounts are specified, otherwise the funds go to the fee_vault.
        transfer_lamports_checked(
            &self.pool.to_account_info(),
            self.maker_broker.as_ref().unwrap_or(&self.fee_vault),
            maker_broker_fee,
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(maker_broker_fee));

        transfer_lamports_checked(
            &self.pool.to_account_info(),
            self.taker_broker.as_ref().unwrap_or(&self.fee_vault),
            taker_broker_fee,
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_broker_fee));

        let remaining_accounts = &mut remaining_accounts.iter();

        // transfer royalties
        let actual_creators_fee = transfer_creators_fee(
            &amm_asset
                .royalty_creators
                .clone()
                .unwrap_or_default()
                .into_iter()
                .map(Into::into)
                .collect(),
            remaining_accounts,
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::Pda(&self.pool.to_account_info()),
            },
        )?;

        // Deduct royalties from the remaining amount left for the seller.
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(actual_creators_fee));

        // Taker pays MM fee, so we subtract it from the amount left for the seller.
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(mm_fee));

        // Finally, transfer remainder to seller
        transfer_lamports(
            &self.pool.to_account_info(),
            &self.taker.to_account_info(),
            left_for_seller,
        )?;

        // No MM fees.
        if pool.config.pool_type == PoolType::Token {
            return Ok(());
        }

        // If MM fees are compounded they go to the pool or shared escrow, otherwise to the owner.
        if pool.config.mm_compound_fees {
            msg!("Compounding MM fees");
            // Send back to shared escrow
            if pool.shared_escrow != Pubkey::default() {
                let incoming_shared_escrow =
                    unwrap_opt!(self.shared_escrow.as_ref(), ErrorCode::BadSharedEscrow)
                        .to_account_info();

                // Validate it's a valid escrow account.
                assert_decode_escrow_account(
                    &incoming_shared_escrow,
                    &self.owner.to_account_info(),
                )?;

                // Validate it's the correct account: the stored escrow account matches the one passed in.
                if incoming_shared_escrow.key != &pool.shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }

                transfer_lamports(
                    &self.pool.to_account_info(),
                    &incoming_shared_escrow,
                    mm_fee,
                )?;
            }
            // Otherwise, already in the pool so no transfer needed.
        } else {
            msg!("Sending mm fees to the owner");
            // Send to owner
            transfer_lamports(
                &self.pool.to_account_info(),
                &self.owner.to_account_info(),
                mm_fee,
            )?;
        }

        Ok(())
    }
}

impl<'info> TradeShared<'info> {
    pub fn validate_buy(&self) -> Result<()> {
        // Ensure correct pool type
        require!(
            self.pool.config.pool_type == PoolType::Trade
                || self.pool.config.pool_type == PoolType::NFT,
            ErrorCode::WrongPoolType
        );

        self.validate()
    }

    pub fn pay_buyer_fees(
        &self,
        amm_asset: AmmAsset,
        fees: Fees,
        creator_accounts: &[AccountInfo<'info>],
    ) -> Result<()> {
        let Fees {
            taker_fee: _,
            tamm_fee,
            maker_broker_fee,
            taker_broker_fee,
            creators_fee,
        } = fees;

        let pool = &self.pool;
        let current_price = pool.current_price(TakerSide::Buy)?;

        let mm_fee = pool.calc_mm_fee(current_price)?;

        /*  **Transfer Fees**
        The buy price is the total price the buyer pays for buying the NFT from the pool.

        buy_price = current_price + taker_fee + mm_fee + creators_fee

        taker_fee = tamm_fee + broker_fee + maker_rebate

        Fees are paid by individual transfers as they go to various accounts depending on the pool type
        and configuration.

        */

        // Determine the SOL destination: owner, pool, or shared escrow account.
        //(!) this block has to come before royalties transfer due to remaining_accounts
        let destination = match pool.config.pool_type {
            // Send money direct to seller/owner
            PoolType::NFT => self.owner.to_account_info(),
            // Send money to the pool
            PoolType::Trade => {
                if pool.shared_escrow != Pubkey::default() {
                    let incoming_shared_escrow =
                        unwrap_opt!(self.shared_escrow.as_ref(), ErrorCode::BadSharedEscrow)
                            .to_account_info();

                    // NB: we don't explicitly assert for presence and decode the escrow account.
                    // This is because a pool owner can close the escrow and DOS buying from their pool.
                    // We already asserted the shared_escrow was a valid MarginAccount during creator.

                    if incoming_shared_escrow.key != &pool.shared_escrow {
                        throw_err!(ErrorCode::BadSharedEscrow);
                    }
                    incoming_shared_escrow
                } else {
                    self.pool.to_account_info()
                }
            }

            PoolType::Token => unreachable!(),
        };

        // Buyer is the taker and pays the taker fee: tamm_fee + maker_broker_fee + taker_broker_fee.
        transfer_lamports(&self.taker, &self.fee_vault, tamm_fee)?;

        transfer_lamports_checked(
            &self.taker,
            self.maker_broker
                .as_ref()
                .map(|acc| acc.to_account_info())
                .as_ref()
                .unwrap_or(&self.fee_vault),
            maker_broker_fee,
        )?;

        transfer_lamports_checked(
            &self.taker,
            self.taker_broker
                .as_ref()
                .map(|acc| acc.to_account_info())
                .as_ref()
                .unwrap_or(&self.fee_vault),
            taker_broker_fee,
        )?;

        // transfer royalties (on top of current price)
        // Buyer pays the royalty fee.
        transfer_creators_fee(
            &amm_asset
                .royalty_creators
                .clone()
                .unwrap_or_default()
                .into_iter()
                .map(Into::into)
                .collect(),
            &mut creator_accounts.iter(),
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::External(&FromExternal {
                    from: &self.taker,
                    sys_prog: &self.native_program,
                }),
            },
        )?;

        // Price always goes to the destination: NFT pool --> owner, Trade pool --> either the pool or the escrow account.
        transfer_lamports(&self.taker, &destination, current_price)?;

        // Trade pools need to check compounding fees
        if matches!(pool.config.pool_type, PoolType::Trade) {
            // If MM fees are compounded they go to the destination to remain
            // in the pool or escrow.
            if pool.config.mm_compound_fees {
                transfer_lamports(&self.taker, &destination, mm_fee)?;
            } else {
                // If MM fees are not compounded they go to the owner.
                transfer_lamports(&self.taker, &self.owner, mm_fee)?;
            }
        }

        Ok(())
    }
}

/* Shared account structs for different standards */

/// Shared accounts for interacting with Metaplex legacy and pNFTs.
#[derive(Accounts)]
pub struct MplxShared<'info> {
    /// The mint account of the NFT.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The Token Metadata metadata account of the NFT.
    /// CHECK: ownership, structure and mint are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    // --------------------------------------- pNft
    /// The Token Metadata edition account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub user_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the destination.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,
}

/// Shared accounts for interacting with Metaplex core assets
#[derive(Accounts)]
pub struct MplCoreShared<'info> {
    /// The MPL core asset account.
    /// CHECK: validated on instruction handler
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: validated on instruction handler
    pub collection: Option<UncheckedAccount<'info>>,

    /// The MPL Core program.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct T22Shared<'info> {
    /// The mint account of the NFT.
    pub mint: Box<InterfaceAccount<'info, Mint>>,
}

pub struct AmmAsset {
    pub pubkey: Pubkey,
    pub collection: Option<Collection>,
    /// Creators used for whitelist verification (fine to include verified = false creators).
    pub whitelist_creators: Option<Vec<Creator>>,
    pub royalty_creators: Option<Vec<Creator>>,
    pub seller_fee_basis_points: u16,
    pub royalty_enforced: bool,
}

pub trait ValidateAsset<'info> {
    fn validate_asset(&self) -> Result<AmmAsset>;
}

impl<'info> ValidateAsset<'info> for T22Shared<'info> {
    fn validate_asset(&self) -> Result<AmmAsset> {
        // Validate mint account and determine if royalites need to be paid.
        let royalties = validate_mint(&self.mint.to_account_info())?;

        let seller_fee_basis_points = royalties.clone().map(|ref r| r.seller_fee).unwrap_or(0);

        let creators = royalties.map(|r| {
            r.creators
                .into_iter()
                .map(|c| Creator {
                    address: c.0,
                    share: c.1,
                    verified: false,
                })
                .collect()
        });

        Ok(AmmAsset {
            pubkey: self.mint.key(),
            collection: None,
            whitelist_creators: None, // creators in Libreplex not verified
            royalty_creators: creators,
            seller_fee_basis_points,
            royalty_enforced: true,
        })
    }
}

impl<'info> ValidateAsset<'info> for MplxShared<'info> {
    fn validate_asset(&self) -> Result<AmmAsset> {
        let metadata = assert_decode_metadata(&self.mint.key(), &self.metadata)?;
        let royalty_enforced = is_royalty_enforced(metadata.token_standard);
        let verified_creators = metadata.creators.clone();

        Ok(AmmAsset {
            pubkey: self.mint.key(),
            collection: metadata.collection,
            whitelist_creators: verified_creators,
            royalty_creators: metadata.creators,
            seller_fee_basis_points: metadata.seller_fee_basis_points,
            royalty_enforced,
        })
    }
}

impl<'info> ValidateAsset<'info> for MplCoreShared<'info> {
    fn validate_asset(&self) -> Result<AmmAsset> {
        let royalties = validate_asset(
            &self.asset.to_account_info(),
            self.collection
                .as_ref()
                .map(|a| a.to_account_info())
                .as_ref(),
        )?;

        let royalty_fee = if let Some(Royalties { basis_points, .. }) = royalties {
            basis_points
        } else {
            0
        };

        let asset = BaseAssetV1::try_from(self.asset.as_ref())?;

        // Fetch the verified creators from the MPL Core asset and map into the expected type.
        let verified_creators: Option<Vec<Creator>> =
            fetch_plugin::<BaseAssetV1, VerifiedCreators>(
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
                verified: true, // mpl-core collections are always verified
            }),
            _ => None,
        };

        let royalty_creators = royalties.map(|r| {
            r.creators
                .into_iter()
                .map(|creator| Creator {
                    address: creator.address,
                    share: creator.percentage,
                    verified: false, // mpl-core does not have a concept of "verified" creator for royalties
                })
                .collect()
        });

        Ok(AmmAsset {
            pubkey: self.asset.key(),
            collection,
            whitelist_creators: verified_creators,
            royalty_creators,
            seller_fee_basis_points: royalty_fee,
            royalty_enforced: true,
        })
    }
}

impl<'info> TradeShared<'info> {
    pub fn calculate_fees(
        &self,
        seller_fee_basis_points: u16,
        user_price: u64,
        taker_side: TakerSide,
        royalty_pct: Option<u16>,
    ) -> Result<Fees> {
        let pool = &self.pool;

        // Calculate fees from the current price.
        let current_price = pool.current_price(taker_side)?;

        // This resolves to 0 for Token & NFT pools.
        let mm_fee = pool.calc_mm_fee(current_price)?;

        let tensor_toolbox::Fees {
            taker_fee,
            protocol_fee: tamm_fee,
            maker_broker_fee,
            taker_broker_fee,
        } = calc_fees(CalcFeesArgs {
            amount: current_price,
            total_fee_bps: TAKER_FEE_BPS,
            broker_fee_pct: BROKER_FEE_PCT,
            maker_broker_pct: MAKER_BROKER_PCT,
            tnsr_discount: false,
        })?;

        let creators_fee = calc_creators_fee(seller_fee_basis_points, current_price, royalty_pct)?;

        // for keeping track of current price + fees charged (computed dynamically)
        // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
        let event = TAmmEvent::BuySellEvent(BuySellEvent {
            current_price,
            taker_fee,
            mm_fee,
            creators_fee,
        });

        // Self-CPI log the event before price check for easier debugging.
        record_event(event, &self.amm_program, pool)?;

        match taker_side {
            TakerSide::Buy => {
                // Check that the  price + royalties + mm_fee doesn't exceed the max amount the user specified to prevent sandwich attacks.
                let price = unwrap_checked!({
                    current_price.checked_add(mm_fee)?.checked_add(creators_fee)
                });

                if price > user_price {
                    throw_err!(ErrorCode::PriceMismatch);
                }
            }
            TakerSide::Sell => {
                // Check that the total price the seller receives isn't lower than the min price the user specified.
                let price = unwrap_checked!({
                    current_price.checked_sub(mm_fee)?.checked_sub(creators_fee)
                });

                if price < user_price {
                    throw_err!(ErrorCode::PriceMismatch);
                }
            }
        }

        Ok(Fees {
            taker_fee,
            tamm_fee,
            maker_broker_fee,
            taker_broker_fee,
            creators_fee,
        })
    }

    pub fn verify_whitelist(&self, asset: &AmmAsset) -> Result<()> {
        let whitelist = unwrap_opt!(self.whitelist.as_ref(), ErrorCode::WrongWhitelist);

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(whitelist, &asset.pubkey, mint_proof)?;

            let leaf = keccak::hash(asset.pubkey.as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(
            &asset.collection,
            &asset.whitelist_creators,
            &full_merkle_proof,
        )
    }

    pub fn close_pool_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        pool_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: pool_ta,
                destination: self.taker.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    pub fn close_taker_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        taker_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: taker_ta,
                destination: self.taker.to_account_info(),
                authority: self.taker.to_account_info(),
            },
        )
    }
}

impl<'info> TransferShared<'info> {
    pub fn verify_whitelist(&self, asset: &AmmAsset) -> Result<()> {
        let whitelist = unwrap_opt!(self.whitelist.as_ref(), ErrorCode::WrongWhitelist);

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(whitelist, &asset.pubkey, mint_proof)?;

            let leaf = keccak::hash(asset.pubkey.as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(
            &asset.collection,
            &asset.whitelist_creators,
            &full_merkle_proof,
        )
    }

    pub fn close_pool_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        pool_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: pool_ta,
                destination: self.owner.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    pub fn close_owner_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        owner_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: owner_ta,
                destination: self.owner.to_account_info(),
                authority: self.owner.to_account_info(),
            },
        )
    }
}

pub enum TransferDirection {
    IntoPool,
    OutOfPool,
}
