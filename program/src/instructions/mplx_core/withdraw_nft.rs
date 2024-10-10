//! Withdraw a MPL Core NFT from a NFT or Trade pool.
use tensor_toolbox::close_account;

use super::*;

/// Instruction accounts.
#[derive(Accounts)]
pub struct WithdrawNftCore<'info> {
    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// The NFT receipt account denoting that an NFT has been deposited into this pool.
    #[account(
        mut,
        seeds=[
            b"nft_receipt".as_ref(),
            core.asset.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump = nft_receipt.bump,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,
}

impl<'info> WithdrawNftCore<'info> {
    fn pre_process_checks(&self) -> Result<AmmAsset> {
        self.core.validate_asset()
    }
}

/// Withdraw a Token22 NFT from a NFT or Trade pool.
pub fn process_withdraw_nft_core<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawNftCore<'info>>,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    let pool = &ctx.accounts.transfer.pool;
    let owner_pubkey = ctx.accounts.transfer.owner.key();

    // transfer the NFT
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.pool_id.as_ref(),
        &[pool.bump[0]],
    ]];

    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&ctx.accounts.transfer.pool.to_account_info()))
        .new_owner(&ctx.accounts.transfer.owner.to_account_info())
        .payer(&ctx.accounts.transfer.owner)
        .collection(ctx.accounts.core.collection.as_ref().map(|c| c.as_ref()))
        .invoke_signed(signer_seeds)?;

    //update pool
    let pool = &mut ctx.accounts.transfer.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

    // Close the NFT receipt account.
    close_account(
        &mut ctx.accounts.nft_receipt.to_account_info(),
        &mut ctx.accounts.transfer.owner.to_account_info(),
    )
}
