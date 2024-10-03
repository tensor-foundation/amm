//! Sell a Token 2022 NFT into a two-sided ("Trade") pool, where the pool is the buyer and ends up as the
//! owner of the NFT.
//!
//! The seller is the owner of the NFT and receives the pool's current price in return.
//! This is separated from Token pool since the NFT will go into an NFT escrow w/ a receipt.
// (!) Keep common logic in sync with sell_nft_token_pool.rs.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked},
};
use escrow_program::instructions::assert_decode_margin_account;
use solana_program::keccak;
use tensor_escrow::instructions::{
    WithdrawMarginAccountCpiTammCpi, WithdrawMarginAccountCpiTammInstructionArgs,
};
use tensor_toolbox::{
    calc_creators_fee, escrow, shard_num,
    token_2022::{transfer::transfer_checked, validate_mint, RoyaltyInfo},
    transfer_creators_fee, transfer_lamports_from_pda, CreatorFeeMode, FromAcc, TCreator,
};
use tensor_vipers::{throw_err, unwrap_checked, unwrap_int, unwrap_opt, Validate};
use whitelist_program::{assert_decode_mint_proof_v2, FullMerkleProof, WhitelistV2};

use crate::{
    calc_taker_fees,
    constants::{CURRENT_POOL_VERSION, MAKER_BROKER_PCT, TFEE_PROGRAM_ID},
    error::ErrorCode,
    program::AmmProgram,
    record_event, BuySellEvent, Fees, NftDepositReceipt, Pool, PoolType, TAmmEvent, TakerSide,
    DEPOSIT_RECEIPT_SIZE, POOL_SIZE,
};

/// Sell a Token22 NFT into a Trade pool.
#[derive(Accounts)]
pub struct SellNftTradePoolT22<'info> {
    /// The owner of the pool and the buyer of the NFT, though the NFT will be escrowed by the pool.
    /// CHECK: has_one = owner in pool (owner is the buyer)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The seller is the owner of the NFT who is selling the NFT into the pool.
    #[account(mut)]
    pub seller: Signer<'info>,

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

    /// The pool the NFT is sold into.
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::BadOwner,
        has_one = whitelist @ ErrorCode::BadWhitelist,
        constraint = pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        constraint = maker_broker.as_ref().map(|c| c.key()).unwrap_or_default() == pool.maker_broker @ ErrorCode::WrongMakerBroker,
        constraint = cosigner.as_ref().map(|c| c.key()).unwrap_or_default() == pool.cosigner @ ErrorCode::BadCosigner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be sold into the pool.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    // Merkle Trees are the only mode that can be used for whitelists in T22 but we set this as an
    // option to support the ability to use other modes in the future, e.g. FVC w/ T22 Metadata.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == seller_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account of the seller, where the NFT will be transferred from.
    #[account(
        mut,
        token::mint = mint,
        token::authority = seller,
        token::token_program = token_program,
    )]
    pub seller_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The TA of the pool, where the NFT will be transferred to.
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
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

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
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

    /// CHECK: address constraint is checked here
    #[account(address = escrow::ID)]
    pub escrow_program: Option<UncheckedAccount<'info>>,
    //
    // ---- [0..n] remaining accounts for royalties transfer hook
}

impl<'info> Validate<'info> for SellNftTradePoolT22<'info> {
    fn validate(&self) -> Result<()> {
        // If the pool has a maker broker set, the maker broker account must be passed in.
        self.pool.validate_maker_broker(&self.maker_broker)?;

        // If the pool has a cosigner, the cosigner account must be passed in.
        self.pool.validate_cosigner(&self.cosigner)?;

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

impl<'info> SellNftTradePoolT22<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof =
                assert_decode_mint_proof_v2(&self.whitelist.key(), &self.mint.key(), mint_proof)?;

            let leaf = keccak::hash(self.mint.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            return Err(ErrorCode::MintProofNotSet.into());
        };

        // Only supporting Merkle proof for now.
        self.whitelist.verify(&None, &None, &full_merkle_proof)
    }

    fn close_seller_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.seller_ta.to_account_info(),
                destination: self.seller.to_account_info(),
                authority: self.seller.to_account_info(),
            },
        )
    }
}

/// Sell a Token22 NFT into a Trade pool.
#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_trade_pool<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, SellNftTradePoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.owner.key();

    // Calculate fees from the current price.
    let current_price = pool.current_price(TakerSide::Sell)?;

    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, MAKER_BROKER_PCT)?;

    let mm_fee = pool.calc_mm_fee(current_price)?;

    // Validate mint account and determine if royalites need to be paid.
    let royalties = validate_mint(&ctx.accounts.mint.to_account_info())?;

    // Transfer the NFT
    let mut transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.seller_ta.to_account_info(),
            to: ctx.accounts.pool_ta.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
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

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    //
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee,
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;

    // Check that the total price the seller receives isn't lower than the min price the user specified.
    let price = unwrap_checked!({ current_price.checked_sub(mm_fee)?.checked_sub(creators_fee) });

    if price < min_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // Close seller ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.close_seller_ata_ctx())?;

    // Signer seeds for the pool account.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    /*  **Transfer Fees**
    The sell price is the total price the seller receives for selling the NFT into the pool.

    sell_price = current_price - taker_fee - mm_fee - creators_fee

    taker_fee = tamm_fee + maker_broker_fee + taker_broker_fee

    Fees are paid by deducting them from the current price, with the final remainder
    then being sent to the seller.
    */

    // If the source funds are from a shared escrow account, we first transfer from there
    // to the pool, to make payments cleaner. After this, we can always send from the pool
    // so the logic is simpler.
    if pool.shared_escrow != Pubkey::default() {
        let incoming_shared_escrow = unwrap_opt!(
            ctx.accounts.shared_escrow.as_ref(),
            ErrorCode::BadSharedEscrow
        )
        .to_account_info();

        let escrow_program = unwrap_opt!(
            ctx.accounts.escrow_program.as_ref(),
            ErrorCode::EscrowProgramNotSet
        )
        .to_account_info();

        // Validate it's a valid escrow account.
        assert_decode_margin_account(
            &incoming_shared_escrow,
            &ctx.accounts.owner.to_account_info(),
        )?;

        // Validate it's the correct account: the stored escrow account matches the one passed in.
        if incoming_shared_escrow.key != &pool.shared_escrow {
            throw_err!(ErrorCode::BadSharedEscrow);
        }

        // Withdraw from escrow account to pool.
        WithdrawMarginAccountCpiTammCpi {
            __program: &escrow_program,
            margin_account: &incoming_shared_escrow,
            pool: &ctx.accounts.pool.to_account_info(),
            owner: &ctx.accounts.owner.to_account_info(),
            destination: &ctx.accounts.pool.to_account_info(),
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
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.fee_vault.to_account_info(),
        tamm_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(tamm_fee));

    // Broker fees. Transfer if accounts are specified, otherwise the funds go to the fee_vault.
    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        ctx.accounts
            .maker_broker
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
        maker_broker_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(maker_broker_fee));

    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        ctx.accounts
            .taker_broker
            .as_ref()
            .unwrap_or(&ctx.accounts.fee_vault),
        taker_broker_fee,
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_broker_fee));

    // Pay creators fee, if required.
    if royalties.is_some() {
        transfer_creators_fee(
            &creators,
            &mut creator_accounts.iter(),
            creators_fee,
            &CreatorFeeMode::Sol {
                from: &FromAcc::Pda(&ctx.accounts.pool.to_account_info()),
            },
        )?;
        left_for_seller = unwrap_int!(left_for_seller.checked_sub(creators_fee));
    }

    // Taker pays MM fee, so we subtract it from the amount left for the seller.
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(mm_fee));

    // transfer remainder to seller
    // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
    // (!) maker rebate already taken out of this amount
    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        left_for_seller,
    )?;

    // If MM fees are compounded they go to the pool or shared escrow, otherwise to the owner.
    if pool.config.mm_compound_fees {
        // Send back to shared escrow
        if pool.shared_escrow != Pubkey::default() {
            let incoming_shared_escrow = unwrap_opt!(
                ctx.accounts.shared_escrow.as_ref(),
                ErrorCode::BadSharedEscrow
            )
            .to_account_info();

            transfer_lamports_from_pda(
                &ctx.accounts.pool.to_account_info(),
                &incoming_shared_escrow,
                mm_fee,
            )?;
        }
        // Otherwise, already in the pool so no transfer needed.
    } else {
        // Send to owner
        transfer_lamports_from_pda(
            &ctx.accounts.pool.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            mm_fee,
        )?;
    }

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

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency == Pubkey::default() && pool.shared_escrow == Pubkey::default() {
        let pool_state_bond = Rent::get()?.minimum_balance(POOL_SIZE);
        let pool_final_balance = pool.get_lamports();
        let lamports_taken = unwrap_int!(pool_initial_balance.checked_sub(pool_final_balance));
        pool.amount = unwrap_int!(pool.amount.checked_sub(lamports_taken));

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(pool_state_bond)),
            ErrorCode::InvalidPoolAmount
        );
    }

    Ok(())
}
