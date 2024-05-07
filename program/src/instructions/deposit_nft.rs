//! User depositing NFTs into their NFT/Trade pool (to sell NFTs)

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use solana_program::keccak;
use tensor_toolbox::{assert_decode_metadata, send_pnft, PnftTransferArgs};
use tensor_whitelist::{self, FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

/// Allows a pool owner to deposit an asset into Trade or NFT pool.
#[derive(Accounts)]
pub struct DepositNft<'info> {
    /// The owner of the pool and the NFT.
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = whitelist,
        has_one = owner,
        // can only deposit to NFT/Trade pool
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// The ATA of the owner, where the NFT will be transferred from.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be escrowed.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ata and pool_ata.
    #[account(
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == owner_ata.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The NFT receipt account denoting that an NFT has been deposited into a pool.
    #[account(
        init,
        payer = owner,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    /// The Token Metadata metadata account of the NFT.
    /// CHECK: assert_decode_metadata checks seeds, owner, and key
    pub metadata: UncheckedAccount<'info>,

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
    pub mint_proof: Option<UncheckedAccount<'info>>,

    // --------------------------------------- pNft
    /// The Token Metadata edition account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    // Master Edition and Edition share the same seeds
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata owner/buyer token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI    #[account(mut)]
    pub owner_token_record: UncheckedAccount<'info>,

    /// The Token Metadata pool token record account of the NFT.
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
    pub pool_token_record: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

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
}

// TODO: extract all the account handler impls into a trait to reduce code duplication?
impl<'info> DepositNft<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let metadata = assert_decode_metadata(&self.mint.key(), &self.metadata)?;

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(&self.whitelist, &self.mint, mint_proof)?;

            let leaf = keccak::hash(self.mint.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        self.whitelist
            .verify(metadata.collection, metadata.creators, full_merkle_proof)
    }

    fn close_owner_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.owner_ata.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.owner.to_account_info(),
            },
        )
    }
}

impl<'info> Validate<'info> for DepositNft<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_deposit_nft(
    ctx: Context<DepositNft>,
    authorization_data: Option<AuthorizationDataLocal>,
) -> Result<()> {
    send_pnft(
        None,
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.owner.to_account_info(),
            payer: &ctx.accounts.owner.to_account_info(),
            source_ata: &ctx.accounts.owner_ata,
            dest_ata: &ctx.accounts.pool_ata,
            dest_owner: &ctx.accounts.pool.to_account_info(),
            nft_mint: &ctx.accounts.mint,
            nft_metadata: &ctx.accounts.metadata,
            nft_edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.instructions,
            owner_token_record: &ctx.accounts.owner_token_record,
            dest_token_record: &ctx.accounts.pool_token_record,
            authorization_rules_program: &ctx.accounts.authorization_rules_program,
            rules_acc: Some(&ctx.accounts.auth_rules.to_account_info()),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    // Close owner ATA to return rent to the owner.
    token_interface::close_account(ctx.accounts.close_owner_ata_ctx())?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.mint = ctx.accounts.mint.key();
    receipt.pool = ctx.accounts.pool.key();

    Ok(())
}
