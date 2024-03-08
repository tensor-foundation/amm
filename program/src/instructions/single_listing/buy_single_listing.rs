use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{
    assert_decode_metadata, calc_creators_fee, send_pnft, transfer_creators_fee,
    transfer_lamports_from_pda, CreatorFeeMode, FromAcc, FromExternal, PnftTransferArgs,
};
use vipers::{throw_err, Validate};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct BuySingleListing<'info> {
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

    /// CHECK: assert_decode_metadata + seeds below
    #[account(mut,
        seeds=[
            mpl_token_metadata::accounts::Metadata::PREFIX,
            mpl_token_metadata::ID.as_ref(),
            nft_mint.key().as_ref(),
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub nft_metadata: UncheckedAccount<'info>,

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
        token::mint = nft_mint, token::authority = nft_escrow_owner,
    )]
    pub nft_escrow_token: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: has_one = owner in single_listing (owner is the seller)
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    // --------------------------------------- pNft

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub nft_edition: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub dest_token_record: UncheckedAccount<'info>,

    pub pnft_shared: ProgNftShared<'info>,

    /// CHECK: validated by mplex's pnft code
    pub auth_rules: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,
    // remaining accounts:
    // 1. 0 to N creator accounts.
}

impl<'info> BuySingleListing<'info> {
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

impl<'info> Validate<'info> for BuySingleListing<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_buy_single_listing<'info, 'b>(
    ctx: Context<'_, 'b, '_, 'info, BuySingleListing<'info>>,
    max_price: u64,
    rules_acc_present: bool,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let single_listing = &ctx.accounts.single_listing;

    let metadata =
        &assert_decode_metadata(&ctx.accounts.nft_mint.key(), &ctx.accounts.nft_metadata)?;

    let current_price = single_listing.price;
    let Fees {
        tswap_fee,
        maker_rebate,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let creators_fee = calc_creators_fee(
        metadata.seller_fee_basis_points,
        current_price,
        metadata.token_standard,
        optional_royalty_pct,
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
        .transfer_lamports(&ctx.accounts.nft_escrow_owner.to_account_info(), tswap_fee)?;
    ctx.accounts
        .transfer_lamports(&ctx.accounts.taker_broker.to_account_info(), broker_fee)?;
    ctx.accounts
        .transfer_lamports(&ctx.accounts.owner.to_account_info(), maker_rebate)?;

    // transfer nft to buyer
    let auth_rules_acc_info = &ctx.accounts.auth_rules.to_account_info();
    let auth_rules = if rules_acc_present {
        Some(auth_rules_acc_info)
    } else {
        None
    };

    let nft_mint_pubkey = ctx.accounts.nft_mint.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"nft_owner",
        nft_mint_pubkey.as_ref(),
        &[ctx.bumps.nft_escrow_owner],
    ]];

    send_pnft(
        Some(signer_seeds),
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.nft_escrow_owner.to_account_info(),
            payer: &ctx.accounts.buyer.to_account_info(),
            source_ata: &ctx.accounts.nft_escrow_token,
            dest_ata: &ctx.accounts.nft_buyer_acc,
            dest_owner: &ctx.accounts.buyer,
            nft_mint: &ctx.accounts.nft_mint,
            nft_metadata: &ctx.accounts.nft_metadata,
            nft_edition: &ctx.accounts.nft_edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.pnft_shared.instructions,
            owner_token_record: &ctx.accounts.owner_token_record,
            dest_token_record: &ctx.accounts.dest_token_record,
            authorization_rules_program: &ctx.accounts.pnft_shared.authorization_rules_program,
            rules_acc: auth_rules,
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    //send royalties
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

    //transfer current_price to owner
    //(!) fees/royalties are paid by TAKER, which in this case is the BUYER (hence they get full price)
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
