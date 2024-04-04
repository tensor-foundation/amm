//! User selling an NFT into a Trade pool
//! We separate this from Token pool since the NFT will go into an NFT escrow w/ a receipt.
//! (!) Keep common logic in sync with sell_nft_token_pool.rs.
use anchor_spl::token_interface::{transfer_checked, Token2022, TransferChecked};
use tensor_toolbox::{
    token_2022::{
        t22_validate_mint,
        token::{safe_initialize_token_account, InitializeTokenAccount},
    },
    transfer_lamports_from_pda,
};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct SellNftTradePoolT22<'info> {
    shared: SellNftSharedT22<'info>,

    /// CHECK: seeds checked so must be Tamm PDA
    #[account(mut,
    seeds = [
        b"nft_owner",
        shared.nft_mint.key().as_ref(),
        ],
        bump
    )]
    pub nft_escrow_owner: AccountInfo<'info>,

    /// CHECK: initialized on instruction; implicitly checked via transfer (will fail if wrong account)
    #[account(mut,
        seeds = [
            b"nft_escrow".as_ref(),
            shared.nft_mint.key().as_ref(),
        ],
        bump,
    )]
    pub nft_escrow: UncheckedAccount<'info>,

    #[account(
        init,
        payer = shared.seller,
        seeds=[
            b"nft_receipt".as_ref(),
            shared.nft_mint.key().as_ref(),
            shared.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)margin acc stored on pool
    #[account(mut)]
    pub margin_account: UncheckedAccount<'info>,

    /// CHECK: checked in handler
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for SellNftTradePoolT22<'info> {
    fn validate(&self) -> Result<()> {
        match self.shared.pool.config.pool_type {
            PoolType::Trade => (),
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
        if self.shared.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }

        self.shared.pool.taker_allowed_to_sell()?;

        Ok(())
    }
}

#[access_control(ctx.accounts.shared.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_trade_pool<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, SellNftTradePoolT22<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
) -> Result<()> {
    let pool = &ctx.accounts.shared.pool;

    // validate mint account

    t22_validate_mint(&ctx.accounts.shared.nft_mint.to_account_info())?;

    // initialize escrow token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.nft_escrow,
            mint: &ctx.accounts.shared.nft_mint.to_account_info(),
            authority: &ctx.accounts.nft_escrow_owner.to_account_info(),
            payer: &ctx.accounts.shared.seller,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            signer_seeds: &[
                b"nft_escrow".as_ref(),
                ctx.accounts.shared.nft_mint.key().as_ref(),
                &[ctx.bumps.nft_escrow],
            ],
        },
        true, // allow existing (might have dangling nft escrow account)
    )?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.shared.nft_seller_acc.to_account_info(),
            to: ctx.accounts.nft_escrow.to_account_info(),
            authority: ctx.accounts.shared.seller.to_account_info(),
            mint: ctx.accounts.shared.nft_mint.to_account_info(),
        },
    );

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

    let current_price = pool.current_price(TakerSide::Sell)?;
    let Fees {
        tswap_fee,
        maker_rebate: _,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let mm_fee = pool.calc_mm_fee(current_price)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    //
    // TODO: This needs to be updated once there is a "standard" way to determine
    // royalties on T22
    emit!(BuySellEvent {
        current_price,
        tswap_fee: taker_fee,
        //record MM here instead of buy tx (when it's technically paid to the MMer)
        //this is because offchain we use the event to determine "true" price paid by taker, which in this case is current price - mm fee
        mm_fee,
        creators_fee: 0, // no royalties on T22
    });

    // Need to include mm_fee to prevent someone editing the MM fee from rugging the seller.

    if unwrap_int!(current_price.checked_sub(mm_fee)) < min_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    let mut left_for_seller = current_price;

    // --------------------------------------- SOL transfers

    //decide where we're sending the money from - margin (marginated pool) or escrow (normal pool)
    let from = match &pool.shared_escrow {
        Some(stored_margin_account) => {
            assert_decode_shared_escrow_account(
                &ctx.accounts.margin_account,
                &ctx.accounts.shared.owner.to_account_info(),
            )?;
            if *ctx.accounts.margin_account.key != *stored_margin_account {
                throw_err!(ErrorCode::BadSharedEscrow);
            }
            ctx.accounts.margin_account.to_account_info()
        }
        None => ctx.accounts.shared.sol_escrow.to_account_info(),
    };

    // transfer fees
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_fee));
    transfer_lamports_from_pda(
        &from,
        &ctx.accounts.shared.fee_vault.to_account_info(),
        tswap_fee,
    )?;
    transfer_lamports_from_pda(
        &from,
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
        &from,
        &ctx.accounts.shared.seller.to_account_info(),
        left_for_seller,
    )?;

    // --------------------------------------- accounting

    //create nft receipt for trade pool
    let receipt_state = &mut ctx.accounts.nft_receipt;
    receipt_state.bump = ctx.bumps.nft_receipt;
    receipt_state.mint = ctx.accounts.shared.nft_mint.key();
    receipt_state.pool = ctx.accounts.nft_escrow.key();

    //update pool accounting
    let pool = &mut ctx.accounts.shared.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));
    pool.taker_sell_count = unwrap_int!(pool.taker_sell_count.checked_add(1));
    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    //MM profit no longer recorded during taker sell txs, only taker buy txs

    Ok(())
}
