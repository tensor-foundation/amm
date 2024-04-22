//! User selling an NFT into a Trade pool
//! We separate this from Token pool since the NFT will go into an NFT escrow w/ a receipt.
//! (!) Keep common logic in sync with sell_nft_token_pool.rs.
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use solana_program::keccak;
use tensor_toolbox::{
    assert_decode_metadata, send_pnft, transfer_creators_fee, transfer_lamports_from_pda,
    CreatorFeeMode, FromAcc, PnftTransferArgs,
};
use tensor_whitelist::{FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use super::*;
use crate::{error::ErrorCode, *};

/// Sells an NFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
/// owner of the NFT. The seller is the owner of the NFT and receives the pool's current price in return.
#[derive(Accounts)]
pub struct SellNftTradePool<'info> {
    /// The owner of the pool and the buyer/recipient of the NFT.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The seller is the owner of the NFT who is selling the NFT into the pool.
    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the mint as the fee shard number
            shard_num!(mint),
        ],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    /// The Pool state account that the NFT is being sold into. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any pool can be specified provided it is a Trade type and the NFT passes at least one
    /// whitelist condition.
    #[account(mut,
        has_one = whitelist @ ErrorCode::BadWhitelist,
        constraint = pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist account that the pool uses to verify the NFTs being sold into it.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == seller_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account of the NFT for the seller's wallet.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller
    )]
    pub seller_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Token Metadata metadata account of the NFT.
    ///  CHECK: seeds and ownership are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = seller,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    // --------------------------------------- pNft
    pub associated_token_program: Program<'info, AssociatedToken>,

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata seller/source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub seller_token_record: UncheckedAccount<'info>,

    /// The Token Metadata pool temporary token record account of the NFT.
    /// CHECK: seeds checked here
    #[account(mut,
            seeds=[
            mpl_token_metadata::accounts::TokenRecord::PREFIX.0,
            mpl_token_metadata::ID.as_ref(),
            mint.key().as_ref(),
            mpl_token_metadata::accounts::TokenRecord::PREFIX.1,
            pool_ata.key().as_ref()
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub pool_token_record: UncheckedAccount<'info>,

    // Todo: add ProgNftShared back in, if possible
    // pub pnft_shared: ProgNftShared<'info>,
    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: UncheckedAccount<'info>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub auth_rules: UncheckedAccount<'info>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: UncheckedAccount<'info>,

    /// The taker broker account that receives the taker fees.
    // TODO: optional account? what checks?
    /// CHECK: need checks specified
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,

    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// Checks are performed in the handler.
    pub cosigner: Option<Signer<'info>>,
    // remaining accounts:
    // optional 0 to N creator accounts.
}

impl<'info> SellNftTradePool<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let metadata = assert_decode_metadata(&self.mint.key(), &self.metadata)?;

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(&self.whitelist, &self.mint, mint_proof)?;

            let leaf = keccak::hash(self.mint.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        self.whitelist
            .verify(metadata.collection, metadata.creators, full_merkle_proof)
    }

    fn close_seller_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.seller_ata.to_account_info(),
                destination: self.seller.to_account_info(),
                authority: self.seller.to_account_info(),
            },
        )
    }
}

impl<'info> Validate<'info> for SellNftTradePool<'info> {
    fn validate(&self) -> Result<()> {
        match self.pool.config.pool_type {
            PoolType::Trade => (),
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }

        self.pool.taker_allowed_to_sell()?;

        Ok(())
    }
}

#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_trade_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTradePool<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
    rules_acc_present: bool,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;

    // transfer nft to escrow
    // has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    let auth_rules_acc_info = &ctx.accounts.auth_rules.to_account_info();
    let auth_rules = if rules_acc_present {
        Some(auth_rules_acc_info)
    } else {
        None
    };
    send_pnft(
        None,
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.seller.to_account_info(),
            payer: &ctx.accounts.seller.to_account_info(),
            source_ata: &ctx.accounts.seller_ata,
            dest_ata: &ctx.accounts.pool_ata,
            dest_owner: &ctx.accounts.pool.to_account_info(),
            nft_mint: &ctx.accounts.mint,
            nft_metadata: &ctx.accounts.metadata,
            nft_edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.instructions,
            owner_token_record: &ctx.accounts.seller_token_record,
            dest_token_record: &ctx.accounts.pool_token_record,
            authorization_rules_program: &ctx.accounts.authorization_rules_program,
            rules_acc: auth_rules,
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.
    token_interface::close_account(ctx.accounts.close_seller_ata_ctx())?;

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.metadata)?;

    let current_price = pool.current_price(TakerSide::Sell)?;
    let Fees {
        tswap_fee,
        maker_rebate: _,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    emit!(BuySellEvent {
        current_price,
        tswap_fee: taker_fee,
        //record MM here instead of buy tx (when it's technically paid to the MMer)
        //this is because offchain we use the event to determine "true" price paid by taker, which in this case is current price - mm fee
        mm_fee,
        creators_fee,
    });

    // Need to include mm_fee to prevent someone editing the MM fee from rugging the seller.
    if unwrap_int!(current_price.checked_sub(mm_fee)) < min_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    let mut left_for_seller = current_price;

    // --------------------------------------- SOL transfers

    //decide where we're sending the money from - shared escrow (shared escrow pool) or escrow (normal pool)
    let from = match pool.shared_escrow.value() {
        Some(stored_shared_escrow) => {
            assert_decode_margin_account(
                &ctx.accounts.shared_escrow,
                &ctx.accounts.owner.to_account_info(),
            )?;
            if *ctx.accounts.shared_escrow.key != *stored_shared_escrow {
                throw_err!(ErrorCode::BadSharedEscrow);
            }
            ctx.accounts.shared_escrow.to_account_info()
        }
        None => ctx.accounts.pool.to_account_info(),
    };

    // transfer fees
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_fee));
    transfer_lamports_from_pda(&from, &ctx.accounts.fee_vault.to_account_info(), tswap_fee)?;
    transfer_lamports_from_pda(
        &from,
        &ctx.accounts.taker_broker.to_account_info(),
        broker_fee,
    )?;

    // transfer royalties
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    let actual_creators_fee = transfer_creators_fee(
        &metadata
            .creators
            .clone()
            .unwrap_or(Vec::new())
            .into_iter()
            .map(Into::into)
            .collect(),
        remaining_accounts,
        creators_fee,
        &CreatorFeeMode::Sol {
            from: &FromAcc::Pda(&from),
        },
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(actual_creators_fee));

    // subtract MM spread before wiring to seller
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(mm_fee));

    // transfer remainder to seller
    // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
    // (!) maker rebate already taken out of this amount
    transfer_lamports_from_pda(
        &from,
        &ctx.accounts.seller.to_account_info(),
        left_for_seller,
    )?;

    // --------------------------------------- accounting

    //create nft receipt for trade pool
    let receipt_state = &mut ctx.accounts.nft_receipt;
    receipt_state.bump = ctx.bumps.nft_receipt;
    receipt_state.mint = ctx.accounts.mint.key();
    receipt_state.pool = ctx.accounts.pool.key();

    //update pool accounting
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    // Pool has bought an NFT, so we decrement the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_sub(1));

    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    pool.stats.accumulated_mm_profit =
        unwrap_int!(pool.stats.accumulated_mm_profit.checked_add(mm_fee));

    // Update the pool's currency balance.
    // Only our instructions can change the pool's SOL balance, so we can just set the amount
    // directly to the post-transaction balance, minus state bond keep-alive.
    if pool.currency.is_sol() {
        pool.amount = unwrap_int!(pool.get_lamports().checked_sub(POOL_STATE_BOND));
    }

    Ok(())
}
