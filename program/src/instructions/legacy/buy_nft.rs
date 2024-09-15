//! Buy a Metaplex legacy NFT or pNFT from a NFT or Trade pool.
use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};

use escrow_program::instructions::assert_decode_margin_account;
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{
    shard_num,
    token_metadata::{assert_decode_metadata, transfer, TransferArgs},
    transfer_creators_fee, CreatorFeeMode, FromAcc, FromExternal,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt, Validate};

use crate::{
    calc_taker_fees,
    constants::{CURRENT_POOL_VERSION, MAKER_BROKER_PCT, TFEE_PROGRAM_ID},
    error::ErrorCode,
    program::AmmProgram,
    record_event, try_autoclose_pool, AuthorizationDataLocal, BuySellEvent, Fees,
    NftDepositReceipt, Pool, PoolType, TAmmEvent, TakerSide, MPL_TOKEN_AUTH_RULES_ID, POOL_SIZE,
};

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNft<'info> {
    /// Owner is the pool owner who created the pool and the nominal owner of the
    /// escrowed NFT. In this transaction they are the seller, though the transfer
    /// of the NFT is handled by the pool.
    /// CHECK: has_one = owner in pool (owner is the seller)
    pub owner: UncheckedAccount<'info>,

    /// Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
    /// is auto-closed.
    /// CHECK: handler logic checks that it's the same as the stored rent payer
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

    /// The Pool state account that holds the NFT to be purchased. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any active pool can be specified provided it is a Trade or NFT type.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        // can only buy from NFT/Trade pool
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The TA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT is held.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The Token Metadata metadata account of the NFT.
    /// CHECK: ownership, structure and mint are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds = [
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // Check that the mint and pool match the nft receipt.
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        close = owner,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Interface<'info, TokenInterface>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,

    // --------------------------------------- pNft
    /// The Token Metadata edition account for the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata token record for the pool.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the buyer.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub buyer_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4) shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Must match the pool's maker_broker
    #[account(
        mut,
        constraint = Some(&maker_broker.key()) == pool.maker_broker.value() @ ErrorCode::WrongBrokerAccount,
    )]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// Checks are performed in the handler.
    pub cosigner: Option<Signer<'info>>,

    /// The AMM program account, used for self-cpi logging.
    pub amm_program: Program<'info, AmmProgram>,
    // remaining accounts:
    // optional 0 to N creator accounts.
}

impl<'info> BuyNft<'info> {
    /// Closes the pool's token account.
    fn close_pool_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.pool_ta.to_account_info(),
                destination: self.buyer.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    /// Transfer lamports from the buyer to the specified address.
    fn transfer_lamports(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        invoke(
            &system_instruction::transfer(self.buyer.key, to.key, lamports),
            &[
                self.buyer.to_account_info(),
                to.clone(),
                self.system_program.to_account_info(),
            ],
        )
        .map_err(Into::into)
    }

    /// Transfers lamports, skipping the transfer if not rent exempt
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

impl<'info> Validate<'info> for BuyNft<'info> {
    /// Validates the BuyNft instruction.
    fn validate(&self) -> Result<()> {
        // If the pool has a cosigner, the cosigner must be passed in and must equal the pool's cosigner.
        if let Some(cosigner) = self.pool.cosigner.value() {
            if self.cosigner.is_none() || self.cosigner.as_ref().unwrap().key != cosigner {
                throw_err!(ErrorCode::BadCosigner);
            }
        }

        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Allows a buyer to purchase a Metaplex legacy NFT or pNFT from a Trade or NFT pool.
#[access_control(ctx.accounts.validate())]
pub fn process_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNft<'info>>,
    max_amount: u64,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.owner.key();

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

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.metadata)?;
    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch check for easy debugging eg if there's a lot of slippage
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee,
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;

    // Check that the  price + royalties + mm_fee doesn't exceed the max amount the user specified to prevent sandwich attacks.
    let price = unwrap_checked!({ current_price.checked_add(mm_fee)?.checked_add(creators_fee) });

    if price > max_amount {
        throw_err!(ErrorCode::PriceMismatch);
    }

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // Transfer nft to buyer
    // Has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    transfer(
        TransferArgs {
            payer: &ctx.accounts.buyer.to_account_info(),
            source: &ctx.accounts.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ta,
            destination: &ctx.accounts.buyer,
            destination_ata: &ctx.accounts.buyer_ta,
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.metadata,
            edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.buyer_token_record.as_ref(),
            authorization_rules: ctx.accounts.authorization_rules.as_ref(),
            authorization_rules_program: ctx.accounts.authorization_rules_program.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // close nft escrow account
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    /*  **Transfer Fees**
    The buy price is the total price the buyer pays for buying the NFT from the pool.

    buy_price = current_price + taker_fee + mm_fee + creators_fee

    taker_fee = tamm_fee + broker_fee + maker_rebate

    Fees are paid by individual transfers as they go to various accounts depending on the pool type
    and configuration.

    */

    // Determine the SOL destination: owner, pool or shared escrow account.
    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        //send money direct to seller/owner
        PoolType::NFT => ctx.accounts.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => match &pool.shared_escrow.value() {
            Some(stored_shared_escrow) => {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(
                    &incoming_shared_escrow,
                    &ctx.accounts.owner.to_account_info(),
                )?;

                if incoming_shared_escrow.key != *stored_shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                incoming_shared_escrow
            }
            None => ctx.accounts.pool.to_account_info(),
        },
        PoolType::Token => unreachable!(),
    };

    // Buyer pays the taker fee: tamm_fee + maker_broker_fee + taker_broker_fee.
    ctx.accounts
        .transfer_lamports(&ctx.accounts.fee_vault.to_account_info(), tamm_fee)?;

    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .maker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
        maker_broker_fee,
    )?;

    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
        taker_broker_fee,
    )?;

    // transfer royalties (on top of current price)
    // Buyer pays the royalty fee.
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    transfer_creators_fee(
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
            from: &FromAcc::External(&FromExternal {
                from: &ctx.accounts.buyer.to_account_info(),
                sys_prog: &ctx.accounts.system_program,
            }),
        },
    )?;

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
                .transfer_lamports(&ctx.accounts.owner.to_account_info(), mm_fee)?;
        }
    }

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Pool has sold an NFT, so we increment the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_add(1));

    pool.stats.taker_buy_count = unwrap_int!(pool.stats.taker_buy_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    if pool.config.pool_type == PoolType::Trade {
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency.is_sol() && pool.shared_escrow.value().is_none() {
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

    // If the pool is an NFT pool, and no remaining NFTs held, we can close it.
    try_autoclose_pool(
        pool,
        ctx.accounts.rent_payer.to_account_info(),
        ctx.accounts.owner.to_account_info(),
    )
}
