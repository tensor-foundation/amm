//! User buying an NFT from an NFT/Trade pool
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{
    assert_decode_metadata, send_pnft, transfer_creators_fee, CreatorFeeMode, FromAcc,
    FromExternal, PnftTransferArgs,
};
use vipers::{throw_err, unwrap_checked, unwrap_int, Validate};

use crate::{error::ErrorCode, *};

use self::constants::CURRENT_POOL_VERSION;

use super::*;

/// Allows a buyer to purchase an NFT from a Trade or NFT pool.
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

    /// The ATA of the buyer, where the NFT will be transferred.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT is held.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ata, pool_ata and the mint stored in the nft receipt.
    #[account(
        constraint = mint.key() == buyer_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The Token Metadata metadata account of the NFT.
    ///  CHECK: seeds and ownership are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// The NFT deposit receipt account, which tracks an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        //can't buy an NFT that's associated with a different pool
        // redundant but extra safety
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        close = owner,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    // --------------------------------------- pNft

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata token record for the pool.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: UncheckedAccount<'info>,

    /// The Token Metadata token record for the buyer.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub buyer_token_record: UncheckedAccount<'info>,

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
    /// CHECK: need checks specified
    // TODO: optional account? what checks?
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,

    pub maker_broker: Option<UncheckedAccount<'info>>,
    // remaining accounts:
    // optional 0 to N creator accounts.
}

impl<'info> BuyNft<'info> {
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
}

impl<'info> Validate<'info> for BuyNft<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_buy_nft<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuyNft<'info>>,
    // Max vs exact so we can add slippage later.
    max_price: u64,
    rules_acc_present: bool,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;

    let owner_pubkey = ctx.accounts.owner.key();

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.metadata)?;

    let current_price = pool.current_price(TakerSide::Buy)?;
    let Fees {
        tswap_fee,
        maker_rebate,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let mm_fee = pool.calc_mm_fee(current_price)?;

    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    emit!(BuySellEvent {
        current_price,
        tswap_fee: taker_fee,
        mm_fee: 0, //record in sell_trade ix for parsing
        creators_fee,
    });

    if current_price > max_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    // transfer nft to buyer
    // has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    let auth_rules_acc_info = &ctx.accounts.auth_rules.to_account_info();
    let auth_rules = if rules_acc_present {
        Some(auth_rules_acc_info)
    } else {
        None
    };

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    send_pnft(
        Some(signer_seeds),
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.buyer.to_account_info(),
            source_ata: &ctx.accounts.pool_ata,
            dest_ata: &ctx.accounts.buyer_ata,
            dest_owner: &ctx.accounts.buyer,
            nft_mint: &ctx.accounts.mint,
            nft_metadata: &ctx.accounts.metadata,
            nft_edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.instructions,
            owner_token_record: &ctx.accounts.pool_token_record,
            dest_token_record: &ctx.accounts.buyer_token_record,
            authorization_rules_program: &ctx.accounts.authorization_rules_program,
            rules_acc: auth_rules,
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    // Close ATA accounts before fee transfers to avoid unbalanced accounts error. CPIs
    // don't have the context of manual lamport balance changes so need to come before.

    // close nft escrow account
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    // --------------------------------------- SOL transfers

    // transfer fees
    ctx.accounts
        .transfer_lamports(&ctx.accounts.fee_vault.to_account_info(), tswap_fee)?;
    ctx.accounts
        .transfer_lamports(&ctx.accounts.taker_broker.to_account_info(), broker_fee)?;

    //(!) this block has to come before royalties transfer due to remaining_accounts
    let destination = match pool.config.pool_type {
        //send money direct to seller/owner
        PoolType::NFT => ctx.accounts.owner.to_account_info(),
        //send money to the pool
        // NB: no explicit MM fees here: that's because it goes directly to the escrow anyways.
        PoolType::Trade => match &pool.shared_escrow.value() {
            Some(stored_shared_escrow) => {
                assert_decode_margin_account(
                    &ctx.accounts.shared_escrow,
                    &ctx.accounts.owner.to_account_info(),
                )?;
                if ctx.accounts.shared_escrow.key != *stored_shared_escrow {
                    throw_err!(ErrorCode::BadSharedEscrow);
                }
                ctx.accounts.shared_escrow.to_account_info()
            }
            None => ctx.accounts.pool.to_account_info(),
        },
        PoolType::Token => unreachable!(),
    };

    // transfer royalties (on top of current price)
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

    ctx.accounts.transfer_lamports(&destination, maker_rebate)?;

    // Price always goes to the destination: NFT pool --> owner, Trade pool either the pool or the escrow account.
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
        let mm_fee = pool.calc_mm_fee(current_price)?;
        pool.stats.accumulated_mm_profit =
            unwrap_checked!({ pool.stats.accumulated_mm_profit.checked_add(mm_fee) });
    }

    // Update the pool's currency balance.
    // It's possible for an external instruction to fund our pool with SOL,
    // but we don't care as that just counts towards total liquidity, so we just
    // use the pool's post-balance minus the state-bond keep-alive.
    if pool.currency.is_sol() {
        pool.amount = unwrap_int!(pool.get_lamports().checked_sub(POOL_STATE_BOND));
    }

    Ok(())
}
