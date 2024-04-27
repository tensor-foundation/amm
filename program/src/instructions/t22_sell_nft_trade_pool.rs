//! User selling an NFT into a Trade pool
//! We separate this from Token pool since the NFT will go into an NFT escrow w/ a receipt.
//! (!) Keep common logic in sync with sell_nft_token_pool.rs.
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use solana_program::keccak;
use tensor_escrow::instructions::{
    WithdrawMarginAccountCpiTammCpi, WithdrawMarginAccountCpiTammInstructionArgs,
};
use tensor_toolbox::{
    token_2022::{
        token::{safe_initialize_token_account, InitializeTokenAccount},
        validate_mint,
    },
    transfer_lamports_from_pda,
};
use tensor_whitelist::{FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::{constants::CURRENT_POOL_VERSION, program::AmmProgram};
use super::*;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct SellNftTradePoolT22<'info> {
    /// CHECK: has_one = owner in pool (owner is the buyer)
    pub owner: UncheckedAccount<'info>,

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

    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist @ ErrorCode::WrongAuthority,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// CHECK: seeds below + assert_decode_mint_proof
    #[account(
        seeds = [
            b"mint_proof".as_ref(),
            mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub mint_proof: UncheckedAccount<'info>,

    /// CHECK: whitelist, token::mint in nft_seller_acc, associated_token::mint in owner_ata_acc
    /// The mint account of the NFT being sold.
    #[account(
        constraint = mint.key() == seller_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == seller_ata.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The ATA of the NFT for the seller's wallet.
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

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: UncheckedAccount<'info>,

    /// CHECK: checked in handler
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,

    pub maker_broker: Option<UncheckedAccount<'info>>,

    pub amm_program: Program<'info, AmmProgram>,

    /// CHECK: address constraint is checked here
    #[account(address = tensor_escrow::ID)]
    pub escrow_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for SellNftTradePoolT22<'info> {
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

impl<'info> SellNftTradePoolT22<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let mint_proof =
            assert_decode_mint_proof_v2(&self.whitelist, &self.mint, &self.mint_proof)?;

        let leaf = keccak::hash(self.mint.key().as_ref());
        let proof = &mut mint_proof.proof.to_vec();
        proof.truncate(mint_proof.proof_len as usize);
        let full_merkle_proof = Some(FullMerkleProof {
            leaf: leaf.0,
            proof: proof.clone(),
        });

        // Only supporting Merkle proof for now; what Metadata types do we support for Token22?
        self.whitelist.verify(None, None, full_merkle_proof)
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

#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_trade_pool<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, SellNftTradePoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let owner_pubkey = ctx.accounts.owner.key();

    // validate mint account

    validate_mint(&ctx.accounts.mint.to_account_info())?;

    // initialize escrow token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.pool_ata.to_account_info(),
            mint: &ctx.accounts.mint.to_account_info(),
            authority: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.seller,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            signer_seeds: &[],
        },
        true, // allow existing (might have dangling nft escrow account)
    )?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.seller_ata.to_account_info(),
            to: ctx.accounts.pool_ata.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // Close seller ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.close_seller_ata_ctx())?;

    let current_price = pool.current_price(TakerSide::Sell)?;
    let Fees {
        tamm_fee,
        maker_rebate: _,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    //
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee,
        creators_fee: 0, // no royalties on T22
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;

    // Need to include mm_fee to prevent someone editing the MM fee from rugging the seller.

    if unwrap_int!(current_price.checked_sub(mm_fee)) < min_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    // Signer seeds for the pool account.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    // --------------------------------------- SOL transfers

    // If the source funds are from a shared escrow account, we first transfer from there
    // to the pool, to make payments cleaner. After this, we can always send from the pool
    // so the logic is simpler.
    let currency_source = if let Some(stored_shared_escrow) = pool.shared_escrow.value() {
        // Validate it's a valid escrow account.
        assert_decode_margin_account(
            &ctx.accounts.shared_escrow,
            &ctx.accounts.owner.to_account_info(),
        )?;

        // Validate it's the correct account: the stored escrow account matches the one passed in.
        if *ctx.accounts.shared_escrow.key != *stored_shared_escrow {
            throw_err!(ErrorCode::BadSharedEscrow);
        }

        // Withdraw from escrow account to pool.
        WithdrawMarginAccountCpiTammCpi {
            __program: &ctx.accounts.escrow_program.to_account_info(),
            margin_account: &ctx.accounts.shared_escrow,
            pool: &ctx.accounts.pool.to_account_info(),
            owner: &ctx.accounts.owner.to_account_info(),
            destination: &ctx.accounts.pool.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            __args: WithdrawMarginAccountCpiTammInstructionArgs {
                bump: pool.bump[0],
                pool_id: pool.pool_id,
                // Seller will receive this minus fees.
                lamports: current_price,
            },
        }
        .invoke_signed(signer_seeds)?;

        ctx.accounts.shared_escrow.to_account_info()
    } else {
        ctx.accounts.pool.to_account_info()
    };

    //(!) This needs to be before any transfers!
    let currency_initial_balance = currency_source.get_lamports();

    let mut left_for_seller = current_price;

    // transfer fees
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_fee));
    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.fee_vault.to_account_info(),
        tamm_fee,
    )?;
    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.taker_broker.to_account_info(),
        broker_fee,
    )?;

    // subtract MM spread before wiring to seller
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(mm_fee));

    // TODO: add royalty payment once available on T22

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
        if pool.shared_escrow.value().is_some() {
            transfer_lamports_from_pda(
                &ctx.accounts.pool.to_account_info(),
                &ctx.accounts.shared_escrow.to_account_info(),
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

    // Update the pool's currency balance.
    // It's possible for an external instruction to fund our pool with SOL
    // and top off a pool's existing balance to bring it above the minimum price and enable
    // an unintended sell. To prevent this we only track SOL additions or subtractions
    // that happen directly in our handlers.
    if pool.currency.is_sol() {
        let currency_final_balance = currency_source.get_lamports();
        let lamports_taken =
            unwrap_int!(currency_initial_balance.checked_sub(currency_final_balance));
        pool.amount = unwrap_int!(pool.amount.checked_sub(lamports_taken));
    }

    Ok(())
}
