//! Deposit a Metaplex legacy NFT or pNFT into a NFT or Trade pool.
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use tensor_toolbox::token_metadata::{transfer, TransferArgs};
use tensor_vipers::{unwrap_int, Validate};

use crate::{error::ErrorCode, *};

/// Instruction accounts.
#[derive(Accounts)]
pub struct DepositNft<'info> {
    /// Metaplex legacy and pNFT shared accounts.
    pub mplx: MplxShared<'info>,

    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = transfer.owner,
        seeds=[
            b"nft_receipt".as_ref(),
            mint.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The mint account of the NFT. It should be the mint account common
    /// to the owner_ta and pool_ta.
    #[account(
        constraint = mint.key() == owner_ta.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == pool_ta.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The token account of the owner, where the NFT will be transferred from.
    #[account(
        mut,
        token::mint = mint,
        token::authority = transfer.owner,
        token::token_program = token_program,
    )]
    pub owner_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The token account of the pool, where the NFT will be escrowed.
    #[account(
        init_if_needed,
        payer = transfer.owner,
        associated_token::mint = mint,
        associated_token::authority = transfer.pool,
        associated_token::token_program = token_program,
    )]
    pub pool_ta: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The SPL Token program for the Mint and ATAs.
    pub token_program: Interface<'info, TokenInterface>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> DepositNft<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.transfer.validate()?;
        self.transfer
            .verify_whitelist(&self.mplx, Some(self.mint.to_account_info()))
    }
}

/// Deposit a Metaplex legacy NFT or pNFT into a NFT or Trade pool.
pub fn process_deposit_nft(
    ctx: Context<DepositNft>,
    authorization_data: Option<AuthorizationDataLocal>,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    transfer(
        TransferArgs {
            payer: &ctx.accounts.transfer.owner.to_account_info(),
            source: &ctx.accounts.transfer.owner.to_account_info(),
            source_ata: &ctx.accounts.owner_ta,
            destination: &ctx.accounts.transfer.pool.to_account_info(),
            destination_ata: &ctx.accounts.pool_ta,
            mint: &ctx.accounts.mint,
            metadata: &ctx.accounts.mplx.metadata,
            edition: &ctx.accounts.mplx.edition,
            system_program: &ctx.accounts.system_program,
            spl_token_program: &ctx.accounts.token_program,
            spl_ata_program: &ctx.accounts.associated_token_program,
            token_metadata_program: ctx.accounts.mplx.token_metadata_program.as_ref(),
            sysvar_instructions: ctx.accounts.mplx.sysvar_instructions.as_ref(),
            source_token_record: ctx.accounts.mplx.user_token_record.as_ref(),
            destination_token_record: ctx.accounts.mplx.pool_token_record.as_ref(),
            authorization_rules: ctx.accounts.mplx.authorization_rules.as_ref(),
            authorization_rules_program: ctx.accounts.mplx.authorization_rules_program.as_ref(),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
        None,
    )?;

    // Close owner ATA to return rent to the owner.
    token_interface::close_account(ctx.accounts.transfer.close_owner_ata_ctx(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.owner_ta.to_account_info(),
    ))?;

    //update pool
    let pool = &mut ctx.accounts.transfer.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.mint = ctx.accounts.mint.key();
    receipt.pool = ctx.accounts.transfer.pool.key();

    Ok(())
}
