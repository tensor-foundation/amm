//! User depositing NFTs into their NFT/Trade pool (to sell NFTs)

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, Token2022, TokenAccount, TransferChecked},
};
use solana_program::keccak;
use tensor_toolbox::token_2022::{
    t22_validate_mint,
    token::{safe_initialize_token_account, InitializeTokenAccount},
};
use tensor_whitelist::{self, FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct DepositNftT22<'info> {
    /// If no external rent payer, set this to the owner.
    #[account(
        mut,
        constraint = rent_payer.key() == owner.key() || Some(rent_payer.key()) == pool.rent_payer,
    )]
    pub rent_payer: Signer<'info>,

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
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

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
    pub mint_proof: UncheckedAccount<'info>,

    /// CHECK: seed in nft_escrow & nft_receipt
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The ATA of the owner, where the NFT will be transferred from.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT will be escrowed.
    #[account(
        init, // TODO: clarify this in design review <-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = rent_payer,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init, //<-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = rent_payer,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub token_program: Program<'info, Token2022>,

    pub system_program: Program<'info, System>,
}

impl<'info> DepositNftT22<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let mint_proof =
            assert_decode_mint_proof_v2(&self.whitelist, &self.mint, &self.mint_proof)?;

        let leaf = keccak::hash(self.mint.key().as_ref());
        let proof = &mut mint_proof.proof.to_vec();
        proof.truncate(mint_proof.proof_len as usize);
        let full_merkle_proof = Some(FullMerkleProof {
            leaf: leaf.0,
            proof: proof.clone(),
        });

        // Only supporting Merkle proof for now; what Metadata types do we support for Token22?
        self.whitelist.verify(None, None, full_merkle_proof)
    }
}

impl<'info> Validate<'info> for DepositNftT22<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_t22_deposit_nft(ctx: Context<DepositNftT22>) -> Result<()> {
    // validate mint account

    t22_validate_mint(&ctx.accounts.mint.to_account_info())?;

    // initialize token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.pool_ata.to_account_info(),
            mint: &ctx.accounts.mint.to_account_info(),
            authority: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.rent_payer,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            signer_seeds: &[],
        },
        false, //<-- this HAS to be false for safety (else single listings and pool listings can get mixed)
    )?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.owner_ata.to_account_info(),
            to: ctx.accounts.pool_ata.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    transfer_checked(transfer_cpi, 1, 0)?; // supply = 1, decimals = 0

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
