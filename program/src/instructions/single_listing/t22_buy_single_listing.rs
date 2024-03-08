use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use mpl_token_metadata::types::TokenStandard;
use tensor_toolbox::{
    calc_creators_fee, token_2022::t22_validate_mint, transfer_lamports_from_pda,
};
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct BuySingleListingT22<'info> {
    //degenerate: fee_acc now === TSwap, keeping around to preserve backwards compatibility
    /// CHECK: has_one = fee_vault in tswap
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,

    #[account(mut,
        seeds=[
            b"single_listing".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump = single_listing.bump[0],
        has_one = nft_mint,
        has_one = owner,
        close = owner,
    )]
    pub single_listing: Box<Account<'info, SingleListing>>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
    )]
    pub nft_buyer_acc: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = nft_mint.key() == nft_escrow_token.mint @ ErrorCode::WrongMint,
        constraint = nft_mint.key() == single_listing.nft_mint @ ErrorCode::WrongMint,
    )]
    pub nft_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: seeds checked so must be Tamm PDA
    #[account(mut,
    seeds = [
        b"nft_owner",
        nft_mint.key().as_ref(),
        ],
        bump
    )]
    pub nft_escrow_owner: AccountInfo<'info>,

    /// Implicitly checked via transfer. Will fail if wrong account.
    /// This is closed below (dest = owner)
    #[account(
        mut,
        seeds=[
            b"nft_escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
        token::mint = nft_mint,
        token::authority = nft_escrow_owner
    )]
    pub nft_escrow_token: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: has_one = owner in single_listing (owner is the seller)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    /// CHECK: checked on the instruction
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,
}

impl<'info> BuySingleListingT22<'info> {
    fn close_nft_escrow_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.nft_escrow_token.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.nft_escrow_owner.to_account_info(),
            },
        )
    }

    fn transfer_lamports(&self, to: &AccountInfo<'info>, lamports: u64) -> Result<()> {
        // Handle buyers that have non-zero data and cannot use system transfer.
        if !self.buyer.data_is_empty() {
            return transfer_lamports_from_pda(&self.buyer.to_account_info(), to, lamports);
        }

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

impl<'info> Validate<'info> for BuySingleListingT22<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_buy_single_listing_t22<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuySingleListingT22<'info>>,
    max_price: u64,
) -> Result<()> {
    let single_listing = &ctx.accounts.single_listing;
    let current_price = single_listing.price;

    // TODO: This needs to be updated once there is a "standard" way to determine token
    // standard and royalties on T22
    let Fees {
        tswap_fee,
        maker_rebate,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let creators_fee = calc_creators_fee(
        0, // currently no royalties for T22
        current_price,
        Some(TokenStandard::NonFungible), // always NFT for T22
        None,
    )?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    emit!(BuySellEvent {
        current_price,
        tswap_fee: taker_fee,
        mm_fee: 0, // no MM fee for buying
        creators_fee,
    });

    if current_price > max_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    // transfer fees
    ctx.accounts
        .transfer_lamports(&ctx.accounts.fee_vault.to_account_info(), tswap_fee)?;
    ctx.accounts
        .transfer_lamports(&ctx.accounts.taker_broker.to_account_info(), broker_fee)?;
    ctx.accounts
        .transfer_lamports(&ctx.accounts.owner.to_account_info(), maker_rebate)?;

    // validate mint account

    t22_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.nft_escrow_token.to_account_info(),
            to: ctx.accounts.nft_buyer_acc.to_account_info(),
            authority: ctx.accounts.nft_escrow_owner.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
        },
    );

    let nft_mint_pubkey = ctx.accounts.nft_mint.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"nft_owner",
        nft_mint_pubkey.as_ref(),
        &[ctx.bumps.nft_escrow_owner],
    ]];

    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
    )?;

    // transfer current_price to owner
    // (!) fees/royalties are paid by TAKER, which in this case is the BUYER (hence they get full price)
    // TODO: add royalties payment once the information is available on T22
    ctx.accounts
        .transfer_lamports(&ctx.accounts.owner.to_account_info(), current_price)?;

    // close nft escrow account
    token_interface::close_account(
        ctx.accounts
            .close_nft_escrow_ctx()
            .with_signer(signer_seeds),
    )?;

    Ok(())
}
