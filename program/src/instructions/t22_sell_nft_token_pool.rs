//! User selling an NFT into a Token pool
//! We separate this from Trade pool since the owner will receive the NFT directly in their ATA.
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
use tensor_toolbox::{token_2022::validate_mint, transfer_lamports_from_pda};
use tensor_whitelist::{FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::{constants::CURRENT_POOL_VERSION, program::AmmProgram};
use super::*;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct SellNftTokenPoolT22<'info> {
    /// CHECK: has_one = owner in pool (owner is the buyer)
    #[account(mut)]
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
        seeds::program = TFEE_PROGRAM_ID,
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
        constraint = mint.key() == owner_ata.mint @ ErrorCode::WrongMint,
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

    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: UncheckedAccount<'info>,

    /// CHECK:
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,

    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// Checks are performed in the handler.
    pub cosigner: Option<Signer<'info>>,

    pub amm_program: Program<'info, AmmProgram>,

    /// CHECK: address constraint is checked here
    #[account(address = tensor_escrow::ID)]
    pub escrow_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for SellNftTokenPoolT22<'info> {
    fn validate(&self) -> Result<()> {
        match self.pool.config.pool_type {
            PoolType::Token => (),
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

impl<'info> SellNftTokenPoolT22<'info> {
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
pub fn process_t22_sell_nft_token_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.owner.key();

    // validate mint account

    validate_mint(&ctx.accounts.mint.to_account_info())?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.seller_ata.to_account_info(),
            to: ctx.accounts.owner_ata.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // Close seller ATA to return rent to the rent payer.
    token_interface::close_account(ctx.accounts.close_seller_ata_ctx())?;

    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    if pool.cosigner.value().is_some() {
        let cosigner = next_account_info(remaining_accounts)?;
        if ctx.accounts.pool.cosigner.value() != Some(cosigner.key) {
            throw_err!(ErrorCode::BadCosigner);
        }
        if !cosigner.is_signer {
            throw_err!(ErrorCode::BadCosigner);
        }
    }

    let current_price = pool.current_price(TakerSide::Sell)?;
    let Fees {
        taker_fee,
        maker_rebate,
        broker_fee,
        tamm_fee,
    } = calc_fees_rebates(current_price)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    //
    // TODO: This needs to be updated once there is a "standard" way to determine
    // royalties on T22
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee: 0,       // no MM fee for token pool
        creators_fee: 0, // no royalties on T22,
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;
    if current_price < min_price {
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
    if let Some(stored_shared_escrow) = pool.shared_escrow.value() {
        // Validate it's a valid escrow account.
        assert_decode_margin_account(
            &ctx.accounts.shared_escrow,
            &ctx.accounts.owner.to_account_info(),
        )?;

        // Validate it's the correct account: the stored escrow account matches the one passed in.
        if *ctx.accounts.shared_escrow.key != *stored_shared_escrow {
            throw_err!(ErrorCode::BadSharedEscrow);
        }

        // Leave maker rebate in the shared escrow account.
        let transfer_amount = unwrap_int!(current_price.checked_sub(maker_rebate));

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
                lamports: transfer_amount,
            },
        }
        .invoke_signed(signer_seeds)?;
    }

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

    // Maker rebate stays in the pool, so is paid deductively by not transferring it out.

    // TODO: add royalty payment to T22 once available

    // transfer remainder to seller
    // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
    // (!) maker rebate already taken out of this amount
    transfer_lamports_from_pda(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        left_for_seller,
    )?;

    // --------------------------------------- accounting

    //update pool accounting
    let pool = &mut ctx.accounts.pool;

    // Pool has bought an NFT, so we decrement the trade counter.
    pool.price_offset = unwrap_int!(pool.price_offset.checked_sub(1));

    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    if pool.currency.is_sol() {
        let pool_final_balance = pool.get_lamports();
        let lamports_taken =
            unwrap_checked!({ pool_initial_balance.checked_sub(pool_final_balance) });
        pool.amount = unwrap_checked!({ pool.amount.checked_sub(lamports_taken) });
    }

    Ok(())
}
