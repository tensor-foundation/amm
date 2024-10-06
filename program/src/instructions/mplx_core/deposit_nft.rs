//! Deposit a Metaplex Core asset into a NFT or Trade pool.

use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct DepositNftCore<'info> {
    /// Metaplex core shared accounts.
    pub core: MplCoreShared<'info>,

    /// Transfer shared accounts.
    pub transfer: TransferShared<'info>,

    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[account(
        init,
        payer = transfer.owner,
        seeds=[
            b"nft_receipt".as_ref(),
            core.asset.key().as_ref(),
            transfer.pool.key().as_ref(),
        ],
        bump,
        space = DEPOSIT_RECEIPT_SIZE,
    )]
    pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

impl<'info> DepositNftCore<'info> {
    fn pre_process_checks(&self) -> Result<()> {
        self.transfer.validate()?;
        self.transfer.verify_whitelist(&self.core, None)
    }
}

/// Deposit a Metaplex Core asset into a NFT or Trade pool.
pub fn process_deposit_nft_core<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositNftCore<'info>>,
) -> Result<()> {
    ctx.accounts.pre_process_checks()?;

    // transfer the NFT
    TransferV1CpiBuilder::new(&ctx.accounts.core.mpl_core_program)
        .asset(&ctx.accounts.core.asset)
        .authority(Some(&ctx.accounts.transfer.owner.to_account_info()))
        .new_owner(&ctx.accounts.transfer.pool.to_account_info())
        .payer(&ctx.accounts.transfer.owner)
        .collection(ctx.accounts.core.collection.as_ref().map(|c| c.as_ref()))
        .invoke()?;

    //update pool
    let pool = &mut ctx.accounts.transfer.pool;
    pool.nfts_held = unwrap_int!(pool.nfts_held.checked_add(1));

    //create nft receipt
    let receipt = &mut ctx.accounts.nft_receipt;
    receipt.bump = ctx.bumps.nft_receipt;
    receipt.mint = ctx.accounts.core.asset.key();
    receipt.pool = ctx.accounts.transfer.pool.key();

    Ok(())
}
