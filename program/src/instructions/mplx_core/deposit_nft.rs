//! Deposit a MPL Core NFT into a NFT or Trade pool.
use super::*;

/// Instruction accounts
#[derive(Accounts)]
pub struct DepositNftCore<'info> {
    pub core: MplCoreShared<'info>,

    pub transfer: TransferShared<'info>,

    /// The NFT receipt account denoting that an NFT has been deposited into this pool.
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

// /// Instruction accounts.
// #[derive(Accounts)]
// pub struct DepositNftCore<'info> {
//     /// The owner of the pool and the NFT.
//     /// CHECK: has_one = owner in pool
//     #[account(mut)]
//     pub owner: Signer<'info>,

//     /// The pool to deposit the NFT into.
//     #[account(
//         mut,
//         seeds = [
//             b"pool",
//             owner.key().as_ref(),
//             pool.pool_id.as_ref(),
//         ],
//         bump = pool.bump[0],
//         has_one = whitelist, has_one = owner,
//         // can only deposit to NFT/Trade pool
//         constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
//         constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
//     )]
//     pub pool: Box<Account<'info, Pool>>,

//     /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
//     #[account(
//         seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
//         bump,
//         seeds::program = whitelist_program::ID
//     )]
//     pub whitelist: Box<Account<'info, WhitelistV2>>,

//     /// CHECK: seeds below + assert_decode_mint_proof
//     #[account(
//         seeds = [
//             b"mint_proof_v2",
//             asset.key().as_ref(),
//             whitelist.key().as_ref(),
//         ],
//         bump,
//         seeds::program = whitelist_program::ID
//     )]
//     pub mint_proof: Option<UncheckedAccount<'info>>,

//     /// The MPL core asset account.
//     /// CHECK: validated on instruction handler
//     #[account(mut)]
//     pub asset: UncheckedAccount<'info>,

//     /// CHECK: validated on instruction handler
//     pub collection: Option<UncheckedAccount<'info>>,

//     /// The NFT receipt account denoting that an NFT has been deposited into this pool.
//     #[account(
//         init,
//         payer = owner,
//         seeds=[
//             b"nft_receipt".as_ref(),
//             asset.key().as_ref(),
//             pool.key().as_ref(),
//         ],
//         bump,
//         space = DEPOSIT_RECEIPT_SIZE,
//     )]
//     pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

//     /// The MPL Core program.
//     /// CHECK: address constraint is checked here
//     #[account(address = mpl_core::ID)]
//     pub mpl_core_program: UncheckedAccount<'info>,

//     /// The Solana system program.
//     pub system_program: Program<'info, System>,
// }

impl<'info> DepositNftCore<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let whitelist = unwrap_opt!(self.transfer.whitelist.as_ref(), ErrorCode::BadWhitelist);

        validate_asset(
            &self.core.asset.to_account_info(),
            self.core
                .collection
                .as_ref()
                .map(|a| a.to_account_info())
                .as_ref(),
        )?;

        let asset = BaseAssetV1::try_from(self.core.asset.as_ref())?;

        // Fetch the verified creators from the MPL Core asset and map into the expected type.
        let creators: Option<Vec<Creator>> = fetch_plugin::<BaseAssetV1, VerifiedCreators>(
            &self.core.asset.to_account_info(),
            PluginType::VerifiedCreators,
        )
        .map(|(_, verified_creators, _)| {
            verified_creators
                .signatures
                .into_iter()
                .map(|c| Creator {
                    address: c.address,
                    share: 0, // No share on VerifiedCreators on MPL Core assets. This is separate from creators used in royalties.
                    verified: c.verified,
                })
                .collect()
        })
        .ok();

        let collection = match asset.update_authority {
            UpdateAuthority::Collection(address) => Some(Collection {
                key: address,
                verified: true, // Only the collection update authority can set a collection, so this is always verified.
            }),
            _ => None,
        };

        let full_merkle_proof = if let Some(mint_proof) = &self.transfer.mint_proof {
            let mint_proof =
                assert_decode_mint_proof_v2(whitelist, &self.core.asset.key(), mint_proof)?;

            let leaf = keccak::hash(self.core.asset.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(&collection, &creators, &full_merkle_proof)
    }
}

impl<'info> Validate<'info> for DepositNftCore<'info> {
    fn validate(&self) -> Result<()> {
        if self.transfer.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Deposit a MPL Core asset into a NFT or Trade pool.
#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_deposit_nft_core<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositNftCore<'info>>,
) -> Result<()> {
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
