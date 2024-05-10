//! User withdrawing an NFT from their Trade pool

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::token_metadata::{transfer, TransferArgs};
use vipers::{throw_err, unwrap_int, Validate};

use crate::{error::ErrorCode, *};

use self::constants::CURRENT_POOL_VERSION;

/// Allows a Trade or NFT pool owner to withdraw an NFT from the pool.
#[derive(Accounts)]
pub struct WithdrawNft<'info> {
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool from which the NFT will be withdrawn.
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

    #[account(
        constraint = mint.key() == owner_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT token is escrowed.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        close = owner,
        //can't withdraw an NFT that's associated with a different pool
        // redundant but extra safety
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // --------------------------------------- pNft

    //can't deserialize directly coz Anchor traits not implemented
    /// CHECK: seeds below
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
    pub metadata: UncheckedAccount<'info>,

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata pool temporary token record account of the NFT.
    /// CHECK: seeds checked here
    #[account(mut,
            seeds=[
            mpl_token_metadata::accounts::TokenRecord::PREFIX.0,
            mpl_token_metadata::ID.as_ref(),
            mint.key().as_ref(),
            mpl_token_metadata::accounts::TokenRecord::PREFIX.1,
            pool_ata.key().as_ref()
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub pool_token_record: Option<UncheckedAccount<'info>>,

    // Todo: add ProgNftShared back in, if possible
    // pub pnft_shared: ProgNftShared<'info>,
    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,
}

impl<'info> WithdrawNft<'info> {
    fn close_pool_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.pool_ata.to_account_info(),
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
) -> Result<()> {
    let pool = &ctx.accounts.pool;

    let owner_pubkey = ctx.accounts.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    transfer(
        TransferArgs {
            payer: &ctx.accounts.owner.to_account_info(),
            source: &ctx.accounts.pool.to_account_info(),
            source_ata: &ctx.accounts.pool_ata,
            destination: &ctx.accounts.owner,
            destination_ata: &ctx.accounts.owner_ata,
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.metadata,
            edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.pool_token_record.as_ref(),
            destination_token_record: ctx.accounts.owner_token_record.as_ref(),
            authorization_rules_program: ctx.accounts.authorization_rules_program.as_ref(),
            authorization_rules: ctx.accounts.authorization_rules.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        Some(signer_seeds),
    )?;

    // close pool ATA
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    Ok(())
}
