//! User withdrawing an NFT from their Trade pool

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::{send_pnft, PnftTransferArgs};
use tensor_whitelist::WhitelistV2;
use vipers::{throw_err, unwrap_int, Validate};

use crate::{error::ErrorCode, *};

use self::constants::CURRENT_POOL_VERSION;

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct WithdrawNft<'info> {
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump = pool.bump[0],
        has_one = whitelist, has_one = owner,
        // can only withdraw from NFT or Trade pool (bought NFTs from Token goes directly to owner)
        constraint = config.pool_type == PoolType::NFT || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: has_one = whitelist in pool
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub dest_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = mint.key() == nft_escrow.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.nft_mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Implicitly checked via transfer. Will fail if wrong account
    /// This is closed below (dest = owner)
    #[account(
        mut,
        seeds=[
            b"nft_escrow".as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        token::mint = mint, token::authority = pool,
    )]
    pub nft_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        close = owner,
        //can't withdraw an NFT that's associated with a different pool
        // redundant but extra safety
        constraint = nft_receipt.nft_mint == mint.key() && nft_receipt.nft_escrow == nft_escrow.key() @ ErrorCode::WrongMint,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// Tied to the pool because used to verify pool seeds
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
            mint.key().as_ref(),
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

    pub pnft_shared: ProgNftShared<'info>,

    /// CHECK: validated by mplex's pnft code
    pub auth_rules: UncheckedAccount<'info>,
}

impl<'info> WithdrawNft<'info> {
    fn close_nft_escrow_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.nft_escrow.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }
}

impl<'info> Validate<'info> for WithdrawNft<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_withdraw_nft<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNft<'info>>,
    authorization_data: Option<AuthorizationDataLocal>,
    rules_acc_present: bool,
) -> Result<()> {
    let auth_rules_acc_info = &ctx.accounts.auth_rules.to_account_info();
    let auth_rules = if rules_acc_present {
        Some(auth_rules_acc_info)
    } else {
        None
    };

    let pool = &ctx.accounts.pool;

    let whitelist_pubkey = ctx.accounts.whitelist.key();
    let owner_pubkey = ctx.accounts.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        whitelist_pubkey.as_ref(),
        owner_pubkey.as_ref(),
        &[pool.bump[0]],
    ]];

    send_pnft(
        Some(signer_seeds),
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.owner.to_account_info(),
            source_ata: &ctx.accounts.nft_escrow,
            dest_ata: &ctx.accounts.dest_token_account,
            dest_owner: &ctx.accounts.owner,
            nft_mint: &ctx.accounts.mint,
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

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    Ok(())
}
