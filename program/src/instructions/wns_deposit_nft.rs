//! User depositing NFTs into their NFT/Trade pool (to sell NFTs)

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, Token2022, TokenAccount, TransferChecked},
};
use tensor_toolbox::token_2022::{
    token::{safe_initialize_token_account, InitializeTokenAccount},
    transfer::transfer_checked,
    wns::{wns_approve, wns_validate_mint, ApproveAccounts},
};
use tensor_whitelist::{self, Whitelist};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct WnsDepositNft<'info> {
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            whitelist.key().as_ref(),
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
    pub whitelist: Box<Account<'info, Whitelist>>,

    #[account(
        mut,
        token::mint = nft_mint,
        token::authority = owner
    )]
    pub nft_source: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: seed in nft_escrow & nft_receipt
    #[account(
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

    /// CHECK: initialized on instruction; implicitly checked via transfer (will fail if wrong account)
    #[account(mut,
        seeds = [
            b"nft_escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
    )]
    pub nft_escrow: UncheckedAccount<'info>,

    #[account(
        init, //<-- this HAS to be init, not init_if_needed for safety (else single listings and pool listings can get mixed)
        payer = owner,
        seeds=[
            b"nft_receipt".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    // intentionally not deserializing, it would be dummy in the case of VOC/FVC based verification
    /// CHECK: seeds below + assert_decode_mint_proof
    #[account(
        seeds = [
            b"mint_proof".as_ref(),
            nft_mint.key().as_ref(),
            whitelist.key().as_ref(),
        ],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub mint_proof: UncheckedAccount<'info>,

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

impl<'info> WnsDepositNft<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        verify_whitelist(&self.whitelist, &self.mint_proof, &self.nft_mint, None)
    }
}

impl<'info> Validate<'info> for WnsDepositNft<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_wns_deposit_nft<'b, 'info>(
    ctx: Context<'_, 'b, '_, 'info, WnsDepositNft<'info>>,
) -> Result<()> {
    // validate mint account

    wns_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

    // initialize token account

    safe_initialize_token_account(
        InitializeTokenAccount {
            token_info: &ctx.accounts.nft_escrow,
            mint: &ctx.accounts.nft_mint.to_account_info(),
            authority: &ctx.accounts.nft_escrow.to_account_info(),
            payer: &ctx.accounts.owner,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            signer_seeds: &[
                b"nft_escrow".as_ref(),
                ctx.accounts.nft_mint.key().as_ref(),
                &[ctx.bumps.nft_escrow],
            ],
        },
        false, //<-- this HAS to be false for safety (else single listings and pool listings can get mixed)
    )?;

    let approve_accounts = ApproveAccounts {
        payer: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
        mint: ctx.accounts.nft_mint.to_account_info(),
        approve_account: ctx.accounts.approve_account.to_account_info(),
        payment_mint: None,
        payer_address: ctx.accounts.owner.to_account_info(),
        distribution: ctx.accounts.distribution.to_account_info(),
        distribution_address: ctx.accounts.distribution.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        distribution_program: ctx.accounts.distribution_program.to_account_info(),
        wns_program: ctx.accounts.wns_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
    };
    // "simulate" royalty payment
    wns_approve(approve_accounts, 0, 0)?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.nft_source.to_account_info(),
            to: ctx.accounts.nft_escrow.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
        },
    );

    transfer_checked(
        transfer_cpi.with_remaining_accounts(vec![
            ctx.accounts.wns_program.to_account_info(),
            ctx.accounts.extra_metas.to_account_info(),
            ctx.accounts.approve_account.to_account_info(),
        ]),
        1, // supply = 1
        0, // decimals = 0
    )?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.nft_mint = ctx.accounts.nft_mint.key();
    receipt.nft_escrow = ctx.accounts.nft_escrow.key();

    Ok(())
}
