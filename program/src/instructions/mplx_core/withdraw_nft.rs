//! Withdraw a MPL Core NFT from a NFT or Trade pool.
use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct WithdrawNftCore<'info> {
    /// The owner of the pool--must sign to withdraw an NFT from the pool.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool holding the NFT.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner,
        // can only withdraw from NFT or Trade pool (bought NFTs from Token goes directly to owner)
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The MPL core asset account.
    /// CHECK: validated on instruction handler
    #[account(mut,  constraint = asset.key() == nft_receipt.mint @ ErrorCode::WrongMint,)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: validated on instruction handler
    pub collection: Option<UncheckedAccount<'info>>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            asset.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
        // can't withdraw an NFT that's associated with a different pool
        constraint = nft_receipt.mint == asset.key() && nft_receipt.pool == pool.key() @ ErrorCode::WrongMint,
        close = owner,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The MPL Core program.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for WithdrawNftCore<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Withdraw a Token22 NFT from a NFT or Trade pool.
#[access_control(ctx.accounts.validate())]
pub fn process_withdraw_nft_core<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNftCore<'info>>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let owner_pubkey = ctx.accounts.owner.key();

    // transfer the NFT
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.asset)
        .authority(Some(&ctx.accounts.pool.to_account_info()))
        .new_owner(&ctx.accounts.owner.to_account_info())
        .payer(&ctx.accounts.owner)
        .collection(ctx.accounts.collection.as_ref().map(|c| c.as_ref()))
        .invoke_signed(signer_seeds)?;

    //update pool
    let pool = &mut ctx.accounts.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    Ok(())
}
