//! Deposit a Token22 NFT into a NFT or Trade pool.

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use solana_program::keccak;
use tensor_toolbox::token_2022::{
    token::{safe_initialize_token_account, InitializeTokenAccount},
    validate_mint,
};
use tensor_whitelist::{self, FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct DepositNftT22<'info> {
    /// The owner of the pool and the NFT.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool to deposit the NFT into.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = whitelist, has_one = owner,
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

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ata and pool_ata.
    #[account(
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == owner_ata.mint @ ErrorCode::WrongMint,
    )]
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
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The NFT receipt account denoting that an NFT has been deposited into this pool.
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

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Program<'info, Token2022>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
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

impl<'info> Validate<'info> for DepositNftT22<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Deposit a Token22 NFT into a NFT or Trade pool.
#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_t22_deposit_nft(ctx: Context<DepositNftT22>) -> Result<()> {
    // validate mint account

    validate_mint(&ctx.accounts.mint.to_account_info())?;

    // initialize token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.pool_ata.to_account_info(),
            mint: &ctx.accounts.mint.to_account_info(),
            authority: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.owner,
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

    // Close owner ATA to return rent to the rent payer.
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
