use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{send_pnft, PnftTransferArgs};

use crate::{error::ErrorCode, *};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut,
        seeds=[
            b"single_listing".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump = single_listing.bump[0],
        has_one = nft_mint,
        has_one = owner,
        close = payer,
    )]
    pub single_listing: Box<Account<'info, SingleListing>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
    )]
    pub nft_dest: Box<InterfaceAccount<'info, TokenAccount>>,

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

    /// Implicitly checked via transfer. Will fail if wrong account
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

    /// CHECK: has_one = owner in single_listing
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    // --------------------------------------- pNft

    //can't deserialize directly coz Anchor traits not implemented
    /// CHECK: assert_decode_metadata + seeds below
    #[account(
        mut,
        seeds=[
            mpl_token_metadata::accounts::Metadata::PREFIX,
            mpl_token_metadata::ID.as_ref(),
            nft_mint.key().as_ref(),
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub nft_metadata: UncheckedAccount<'info>,

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub nft_edition: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub dest_token_record: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub pnft_shared: ProgNftShared<'info>,

    /// CHECK: validated by mplex's pnft code
    pub auth_rules: UncheckedAccount<'info>,

    //separate payer so that a program can list with owner being a PDA
    #[account(mut)]
    pub payer: Signer<'info>,
}

impl<'info> Delist<'info> {
    fn close_nft_escrow_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.nft_escrow_token.to_account_info(),
                destination: self.payer.to_account_info(),
                authority: self.nft_escrow_owner.to_account_info(),
            },
        )
    }
}

pub fn process_delist<'info>(
    ctx: Context<'_, '_, '_, 'info, Delist<'info>>,
    authorization_data: Option<AuthorizationDataLocal>,
    rules_acc_present: bool,
) -> Result<()> {
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
            payer: &ctx.accounts.payer.to_account_info(),
            source_ata: &ctx.accounts.nft_escrow_token,
            dest_ata: &ctx.accounts.nft_dest,
            dest_owner: &ctx.accounts.owner,
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

    // close nft escrow account
    token_interface::close_account(
        ctx.accounts
            .close_nft_escrow_ctx()
            .with_signer(signer_seeds),
    )?;

    emit!(DelistEvent {
        current_price: ctx.accounts.single_listing.price,
    });

    Ok(())
}
