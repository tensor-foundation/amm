//! User depositing NFTs into their NFT/Trade pool (to sell NFTs)

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use solana_program::keccak;
use tensor_toolbox::{assert_decode_metadata, send_pnft, PnftTransferArgs};
use tensor_whitelist::{self, FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct DepositNft<'info> {
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.identifier.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = whitelist, has_one = owner,
        // can only deposit to NFT/Trade pool
        constraint = config.pool_type == PoolType::NFT || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    #[account(mut, token::mint = mint, token::authority = owner)]
    pub source_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: seed in nft_escrow & nft_receipt
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Implicitly checked via transfer. Will fail if wrong account
    #[account(
        init, //<-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = owner,
        seeds=[
            b"nft_escrow".as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        token::mint = mint, token::authority = pool,
    )]
    pub escrow_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init, //<-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = owner,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: assert_decode_metadata checks seeds, owner, and key
    pub metadata: UncheckedAccount<'info>,

    // intentionally not deserializing, it would be dummy in the case of VOC/FVC based verification
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

    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    /// CHECK: seeds checked on Token Metadata CPI
    pub edition: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: UncheckedAccount<'info>,

    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub dest_token_record: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    // TODO: try to go back to ProgNftShared, if Kinobi can support it

    //can't deserialize directly coz Anchor traits not implemented
    /// CHECK: address below
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    //sysvar ixs don't deserialize in anchor
    /// CHECK: address below
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,

    /// CHECK: address below
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: UncheckedAccount<'info>,

    /// CHECK: validated by mplex's pnft code
    pub auth_rules: Option<UncheckedAccount<'info>>,
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
            source_ata: &ctx.accounts.source_token_account,
            dest_ata: &ctx.accounts.escrow_token_account,
            dest_owner: &ctx.accounts.pool.to_account_info(),
            nft_mint: &ctx.accounts.mint,
            nft_metadata: &ctx.accounts.metadata,
            nft_edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.instructions,
            owner_token_record: &ctx.accounts.owner_token_record,
            dest_token_record: &ctx.accounts.dest_token_record,
            authorization_rules_program: &ctx.accounts.authorization_rules_program,
            rules_acc: ctx.accounts.auth_rules.as_deref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.nft_mint = ctx.accounts.mint.key();
    receipt.nft_escrow = ctx.accounts.escrow_token_account.key();

    Ok(())
}
