//! Buy a Token22 NFT from a NFT or Trade pool.
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked},
};
use tensor_toolbox::{
    calc_creators_fee,
    token_2022::{transfer::transfer_checked, validate_mint, RoyaltyInfo},
    transfer_creators_fee, CreatorFeeMode, FromAcc, FromExternal, TCreator,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt, Validate};

use self::{
    constants::{CURRENT_POOL_VERSION, MAKER_BROKER_PCT},
    program::AmmProgram,
};
use super::*;
use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct BuyNftT22<'info> {
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
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        constraint = maker_broker.as_ref().map(|c| c.key()).unwrap_or_default() == pool.maker_broker @ ErrorCode::WrongMakerBroker,
        constraint = cosigner.as_ref().map(|c| c.key()).unwrap_or_default() == pool.cosigner @ ErrorCode::BadCosigner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The TA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT will be escrowed.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // Check the receipt is for the correct pool and mint.
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        close = buyer,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4) shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Must match the pool's maker_broker
    #[account(mut)]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    pub cosigner: Option<Signer<'info>>,

    /// The AMM program account, used for self-cpi logging.
    pub amm_program: Program<'info, AmmProgram>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> BuyNftT22<'info> {
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

impl<'info> Validate<'info> for BuyNftT22<'info> {
    fn validate(&self) -> Result<()> {
        // If the pool has a cosigner, the cosigner account must be passed in.
        if self.pool.cosigner != Pubkey::default() {
            require!(self.cosigner.is_some(), ErrorCode::MissingCosigner);
        }

        // If the pool has a maker broker set, the maker broker account must be passed in.
        if self.pool.maker_broker != Pubkey::default() {
            require!(self.maker_broker.is_some(), ErrorCode::MissingMakerBroker);
        }

        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Buy a Token22 NFT from a NFT or Trade pool.
#[access_control(ctx.accounts.validate())]
pub fn process_t22_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNftT22<'info>>,
    // Max vs exact so we can add slippage later.
    max_amount: u64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.owner.key();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Buy)?;

    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    // This resolves to 0 for NFT pools.
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // Validate mint account and determine if royalites need to be paid.
    let royalties = validate_mint(&ctx.accounts.mint.to_account_info())?;

    // Transfer the NFT.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // Setup the transfer CPI
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.pool_ta.to_account_info(),
            to: ctx.accounts.buyer_ta.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    // this will only add the remaining accounts required by a transfer hook if we
    // recognize the hook as a royalty one
    let (creators, creator_accounts, creators_fee) = if let Some(RoyaltyInfo {
        creators,
        seller_fee,
    }) = &royalties
    {
        // add remaining accounts to the transfer cpi
        transfer_cpi = transfer_cpi.with_remaining_accounts(ctx.remaining_accounts.to_vec());

        let mut creator_infos = Vec::with_capacity(creators.len());
        let mut creator_data = Vec::with_capacity(creators.len());
        // filter out the creators accounts; the transfer will fail if there
        // are missing creator accounts – i.e., the creator is on the `creator_data`
        // but the account is not in the `creator_infos`
        creators.iter().for_each(|c| {
            let creator = TCreator {
                address: c.0,
                share: c.1,
                verified: true,
            };

            if let Some(account) = ctx
                .remaining_accounts
                .iter()
                .find(|account| &creator.address == account.key)
            {
                creator_infos.push(account.clone());
            }

            creator_data.push(creator);
        });

        // No optional royalties.
        let creators_fee = calc_creators_fee(*seller_fee, current_price, None, Some(100))?;

        (creator_data, creator_infos, creators_fee)
    } else {
        (vec![], vec![], 0)
    };

    // For keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
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

    // Perform the transfer
    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // close nft escrow account
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

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
        PoolType::NFT => ctx.accounts.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => {
            if pool.shared_escrow != Pubkey::default() {
                let incoming_shared_escrow = unwrap_opt!(
                    ctx.accounts.shared_escrow.as_ref(),
                    ErrorCode::BadSharedEscrow
                )
                .to_account_info();

                assert_decode_margin_account(
                    &incoming_shared_escrow,
                    &ctx.accounts.owner.to_account_info(),
                )?;

                if incoming_shared_escrow.key != &pool.shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                incoming_shared_escrow
            } else {
                ctx.accounts.pool.to_account_info()
            }
        }
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

    // Pay creators royalties.
    if royalties.is_some() {
        transfer_creators_fee(
            &creators,
            &mut creator_accounts.iter(),
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::External(&FromExternal {
                    from: &ctx.accounts.buyer.to_account_info(),
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

    //record the entirety of MM fee during the buy tx
    if pool.config.pool_type == PoolType::Trade {
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
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

    try_autoclose_pool(
        pool,
        ctx.accounts.rent_payer.to_account_info(),
        ctx.accounts.owner.to_account_info(),
    )
}
