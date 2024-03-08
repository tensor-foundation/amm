use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked},
};
use mpl_token_metadata::types::TokenStandard;
use tensor_toolbox::{
    calc_creators_fee,
    token_2022::{
        transfer::transfer_checked,
        wns::{wns_approve, wns_validate_mint, ApproveAccounts},
    },
    transfer_lamports_from_pda,
};
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct WnsBuySingleListing<'info> {
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
        mint::token_program = anchor_spl::token_interface::spl_token_2022::id(),
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

    // ---- WNS royalty enforcement
    /// CHECK: checked on approve CPI
    #[account(mut)]
    pub approve_account: UncheckedAccount<'info>,

    /// CHECK: checked on approve CPI
    #[account(mut)]
    pub distribution: UncheckedAccount<'info>,

    /// CHECK: checked on approve CPI
    pub wns_program: UncheckedAccount<'info>,

    /// CHECK: checked on approve CPI
    pub distribution_program: UncheckedAccount<'info>,

    /// CHECK: checked on transfer CPI
    pub extra_metas: UncheckedAccount<'info>,
}

impl<'info> WnsBuySingleListing<'info> {
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

impl<'info> Validate<'info> for WnsBuySingleListing<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn wns_process_buy_single_listing<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, WnsBuySingleListing<'info>>,
    max_price: u64,
) -> Result<()> {
    // validate mint account
    let seller_fee_basis_points = wns_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

    let single_listing = &ctx.accounts.single_listing;
    let current_price = single_listing.price;
    let creators_fee = calc_creators_fee(
        seller_fee_basis_points,
        current_price,
        Some(TokenStandard::ProgrammableNonFungible), // <- enforced royalties
        None,
    )?;

    let Fees {
        tswap_fee,
        maker_rebate,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;

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

    let approve_accounts = ApproveAccounts {
        payer: ctx.accounts.buyer.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
        mint: ctx.accounts.nft_mint.to_account_info(),
        approve_account: ctx.accounts.approve_account.to_account_info(),
        payment_mint: None,
        payer_address: ctx.accounts.buyer.to_account_info(),
        distribution: ctx.accounts.distribution.to_account_info(),
        distribution_address: ctx.accounts.distribution.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        distribution_program: ctx.accounts.distribution_program.to_account_info(),
        wns_program: ctx.accounts.wns_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
    };
    // royalty payment
    wns_approve(approve_accounts, current_price, creators_fee)?;

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
        transfer_cpi
            .with_remaining_accounts(vec![
                ctx.accounts.wns_program.to_account_info(),
                ctx.accounts.extra_metas.to_account_info(),
                ctx.accounts.approve_account.to_account_info(),
            ])
            .with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
    )?;

    // transfer current_price to owner
    // (!) fees/royalties are paid by TAKER, which in this case is the BUYER (hence they get full price)
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
