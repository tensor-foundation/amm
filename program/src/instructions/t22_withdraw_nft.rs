//! User withdrawing an NFT from their Trade pool

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        self, transfer_checked, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked,
    },
};
use tensor_toolbox::token_2022::validate_mint;
use tensor_whitelist::WhitelistV2;
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, *};

#[derive(Accounts)]
#[instruction(config: PoolConfig)]
pub struct WithdrawNftT22<'info> {
    /// Tied to the pool because used to verify pool seeds
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
        has_one = whitelist, has_one = owner,
        // can only withdraw from NFT or Trade pool (bought NFTs from Token goes directly to owner)
        constraint = config.pool_type == PoolType::NFT || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// CHECK: has_one = whitelist in pool
    #[account(
        seeds = [&whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    #[account(
        constraint = mint.key() == pool_ata.mint @ ErrorCode::WrongMint,
        constraint = mint.key() == nft_receipt.mint @ ErrorCode::WrongMint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

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
        //can't withdraw an NFT that's associated with a different pool
        constraint = nft_receipt.mint == mint.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        close = owner,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    pub token_program: Program<'info, Token2022>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawNftT22<'info> {
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

impl<'info> Validate<'info> for WithdrawNftT22<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn process_t22_withdraw_nft<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNftT22<'info>>,
) -> Result<()> {
    // validate mint account

    validate_mint(&ctx.accounts.mint.to_account_info())?;

    // transfer the NFT

    let transfer_cpi = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.pool_ata.to_account_info(),
            to: ctx.accounts.owner_ata.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );

    let pool = &ctx.accounts.pool;
    let owner_pubkey = ctx.accounts.owner.key();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    transfer_checked(
        transfer_cpi.with_signer(signer_seeds),
        1, // supply = 1
        0, // decimals = 0
    )?;

    // close pool ATA
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    Ok(())
}
