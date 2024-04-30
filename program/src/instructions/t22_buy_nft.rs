//! User buying an NFT from an NFT/Trade pool
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use tensor_toolbox::token_2022::validate_mint;
use tensor_whitelist::{self, WhitelistV2};
use vipers::{throw_err, unwrap_checked, unwrap_int, Validate};

use self::{constants::CURRENT_POOL_VERSION, program::AmmProgram};
use super::*;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct BuyNftT22<'info> {
    /// CHECK: has_one = owner in pool (owner is the seller)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

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

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner, has_one = whitelist,
        constraint = config.pool_type == PoolType::NFT || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Needed for pool seeds derivation, has_one = whitelist on pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// The ATA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be escrowed.
    #[account(
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = mint.key() == buyer_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        //can't buy an NFT that's associated with a different pool
        // TODO: check this constraint replaces the old one sufficiently
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        close = buyer,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared_escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow_account: UncheckedAccount<'info>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    pub amm_program: Program<'info, AmmProgram>,
}

impl<'info> BuyNftT22<'info> {
    fn close_pool_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.pool_ata.to_account_info(),
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
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_t22_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNftT22<'info>>,
    // Max vs exact so we can add slippage later.
    max_price: u64,
) -> Result<()> {
    // validate mint account

    validate_mint(&ctx.accounts.mint.to_account_info())?;

    let pool = &ctx.accounts.pool;
    let pool_initial_balance = pool.get_lamports();
    let owner_pubkey = ctx.accounts.owner.key();

    let current_price = pool.current_price(TakerSide::Buy)?;
    let Fees {
        taker_fee,
        tamm_fee,
        maker_broker_fee,
        taker_broker_fee,
    } = calc_taker_fees(current_price, pool.config.maker_broker_pct)?;
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    //
    // TODO: This needs to be updated once there is a "standard" way to determine
    // royalties on T22
    let event = TAmmEvent::BuySellEvent(BuySellEvent {
        current_price,
        taker_fee,
        mm_fee: if pool.config.pool_type == PoolType::Trade {
            mm_fee
        } else {
            0
        },
        creators_fee: 0,
    });

    // Self-CPI log the event.
    record_event(event, &ctx.accounts.amm_program, &ctx.accounts.pool)?;

    if current_price > max_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    // transfer the NFT

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.pool_ata.to_account_info(),
            to: ctx.accounts.buyer_ata.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

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
        PoolType::Trade => match pool.shared_escrow.value() {
            Some(stored_shared_escrow_account) => {
                assert_decode_margin_account(
                    &ctx.accounts.shared_escrow_account,
                    &ctx.accounts.owner.to_account_info(),
                )?;
                if *ctx.accounts.shared_escrow_account.key != *stored_shared_escrow_account {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                ctx.accounts.shared_escrow_account.to_account_info()
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
            .unwrap_or(&destination),
        maker_broker_fee,
    )?;
    ctx.accounts.transfer_lamports_min_balance(
        ctx.accounts
            .taker_broker
            .as_ref()
            .map(|acc| acc.to_account_info())
            .as_ref()
            .unwrap_or(&destination),
        taker_broker_fee,
    )?;

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

    // TODO: add royalty payment once available on T22

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
        let mm_fee = pool.calc_mm_fee(current_price)?;
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance, by tracking additions and subtractions as a result of this trade.
    // Shared escrow pools don't have a SOL balance because the shared escrow account holds it.
    if pool.currency.is_sol() && pool.shared_escrow.value().is_none() {
        let pool_final_balance = pool.get_lamports();
        let lamports_added =
            unwrap_checked!({ pool_final_balance.checked_sub(pool_initial_balance) });
        pool.amount = unwrap_checked!({ pool.amount.checked_add(lamports_added) });

        // Sanity check to avoid edge cases:
        require!(
            pool.amount <= unwrap_int!(pool_final_balance.checked_sub(POOL_STATE_BOND)),
            ErrorCode::InvalidPoolAmount
        );
    }

    Ok(())
}
