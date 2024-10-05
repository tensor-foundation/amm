use anchor_lang::prelude::*;
use anchor_spl::token_interface::CloseAccount;
use constants::CURRENT_POOL_VERSION;
use mpl_token_metadata::types::{Collection, Creator};
use program::AmmProgram;
use solana_program::keccak;
use tensor_toolbox::{escrow, shard_num, token_metadata::assert_decode_metadata};
use tensor_vipers::{throw_err, unwrap_opt, Validate};
use whitelist_program::{FullMerkleProof, WhitelistV2};

use crate::{error::ErrorCode, *};

use super::constants::TFEE_PROGRAM_ID;

use mpl_core::{
    accounts::BaseAssetV1,
    fetch_plugin,
    types::{PluginType, UpdateAuthority, VerifiedCreators},
};
use tensor_toolbox::metaplex_core::validate_asset;

/* AMM Protocol shared account structs*/

/// Shared accounts for transfer instructions: deposit & withdraw
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TransferShared<'info> {
    /// The owner of the pool and the NFT.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The pool the asset is being transferred to/from.
    #[account(
        mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::BadOwner,
        // can only transfer to/from NFT & Trade pools
        constraint = pool.config.pool_type == PoolType::NFT || pool.config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::BadWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,
}

impl<'info> Validate<'info> for TransferShared<'info> {
    fn validate(&self) -> Result<()> {
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }
        Ok(())
    }
}

/// Shared accounts for trade instructions: buy & sell
/// Mint and token accounts are not included here as the AMM program supports multiple types of
/// NFTs, not all of which are SPL token based.
#[derive(Accounts)]
pub struct TradeShared<'info> {
    /// The owner of the pool and the buyer/recipient of the NFT.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The taker is the user buying or selling the NFT.
    #[account(mut)]
    pub taker: Signer<'info>,

    /// The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
    /// is auto-closed.
    /// CHECK: handler logic checks that it's the same as the stored rent payer
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,

    /// Fee vault account owned by the TFEE program.
    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the pool as the fee shard number
            shard_num!(pool),
        ],
        seeds::program = TFEE_PROGRAM_ID,
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    /// The Pool state account that the NFT is being sold into. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any active pool can be specified provided it is a Token type and the NFT passes at least one
    /// whitelist condition.
    #[account(mut,
        seeds = [
            b"pool",
            owner.key().as_ref(),
            pool.pool_id.as_ref(),
        ],
        bump = pool.bump[0],
        has_one = owner @ ErrorCode::BadOwner,
        constraint = pool.expiry >= Clock::get()?.unix_timestamp @ ErrorCode::ExpiredPool,
        constraint = maker_broker.as_ref().map(|c| c.key()).unwrap_or_default() == pool.maker_broker @ ErrorCode::WrongMakerBroker,
        constraint = cosigner.as_ref().map(|c| c.key()).unwrap_or_default() == pool.cosigner @ ErrorCode::BadCosigner,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist account that the pool uses to verify the NFTs being sold into it.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = whitelist_program::ID,
        constraint = whitelist.key() == pool.whitelist @ ErrorCode::BadWhitelist,
    )]
    pub whitelist: Option<Box<Account<'info, WhitelistV2>>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The shared escrow account for pools that have liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)shared escrow acc stored on pool
    #[account(mut)]
    pub shared_escrow: Option<UncheckedAccount<'info>>,

    /// The account that receives the maker broker fee.
    /// CHECK: Constraint checked on pool.
    #[account(mut)]
    pub maker_broker: Option<UncheckedAccount<'info>>,

    /// The account that receives the taker broker fee.
    /// CHECK: The caller decides who receives the fee, so no constraints are needed.
    #[account(mut)]
    pub taker_broker: Option<UncheckedAccount<'info>>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// CHECK: Constraint checked on pool.
    pub cosigner: Option<Signer<'info>>,

    /// The AMM program account, used for self-cpi logging.
    pub amm_program: Program<'info, AmmProgram>,

    /// The escrow program account for shared liquidity pools.
    /// CHECK: address constraint is checked here
    #[account(address = escrow::ID)]
    pub escrow_program: Option<UncheckedAccount<'info>>,
}

impl<'info> Validate<'info> for TradeShared<'info> {
    fn validate(&self) -> Result<()> {
        // If the pool has a cosigner, the cosigner account must be passed in.
        if self.pool.cosigner != Pubkey::default() {
            require!(self.cosigner.is_some(), ErrorCode::MissingCosigner);
        }

        // If the pool has a maker broker set, the maker broker account must be passed in.
        if self.pool.maker_broker != Pubkey::default() {
            require!(self.maker_broker.is_some(), ErrorCode::MissingMakerBroker);
        }

        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }

        Ok(())
    }
}

pub trait Sell {
    fn validate_sell(&self, pool_type: &PoolType) -> Result<()>;
}

impl<'info> Sell for TradeShared<'info> {
    fn validate_sell(&self, pool_type: &PoolType) -> Result<()> {
        // Ensure correct pool type
        require!(
            self.pool.config.pool_type == *pool_type,
            ErrorCode::WrongPoolType
        );

        self.pool.taker_allowed_to_sell()?;

        self.validate()
    }
}

pub trait Buy {
    fn validate_buy(&self) -> Result<()>;
}

impl<'info> Buy for TradeShared<'info> {
    fn validate_buy(&self) -> Result<()> {
        // Ensure correct pool type
        require!(
            self.pool.config.pool_type == PoolType::Trade
                || self.pool.config.pool_type == PoolType::NFT,
            ErrorCode::WrongPoolType
        );

        self.validate()
    }
}

/* Shared account structs for different standards */

/// Shared accounts for interacting with Metaplex legacy and pNFTs.
#[derive(Accounts)]
pub struct MplxShared<'info> {
    /// The Token Metadata metadata account of the NFT.
    /// CHECK: ownership, structure and mint are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    // --------------------------------------- pNft
    /// The Token Metadata edition account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub user_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata token record for the destination.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub pool_token_record: Option<UncheckedAccount<'info>>,

    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Option<UncheckedAccount<'info>>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub authorization_rules: Option<UncheckedAccount<'info>>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: Option<UncheckedAccount<'info>>,
}

/// Shared accounts for interacting with Metaplex core assets
#[derive(Accounts)]
pub struct MplCoreShared<'info> {
    /// The MPL core asset account.
    /// CHECK: validated on instruction handler
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: validated on instruction handler
    pub collection: Option<UncheckedAccount<'info>>,

    /// The MPL Core program.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct T22<'info> {
    pub sys_program: Program<'info, System>,
}

pub struct AmmAsset {
    pub pubkey: Pubkey,
    pub collection: Option<Collection>,
    pub creators: Option<Vec<Creator>>,
}

pub trait ValidateAsset<'info> {
    fn validate_asset(&self, mint: Option<AccountInfo<'info>>) -> Result<AmmAsset>;
}

impl<'info> ValidateAsset<'info> for T22<'info> {
    fn validate_asset(&self, mint: Option<AccountInfo<'info>>) -> Result<AmmAsset> {
        let mint = unwrap_opt!(mint, ErrorCode::WrongMint);

        Ok(AmmAsset {
            pubkey: mint.key(),
            collection: None,
            creators: None,
        })
    }
}

impl<'info> ValidateAsset<'info> for MplxShared<'info> {
    fn validate_asset(&self, mint: Option<AccountInfo<'info>>) -> Result<AmmAsset> {
        let mint = unwrap_opt!(mint, ErrorCode::WrongMint);

        let metadata = assert_decode_metadata(&mint.key(), &self.metadata)?;

        Ok(AmmAsset {
            pubkey: mint.key(),
            collection: metadata.collection,
            creators: metadata.creators,
        })
    }
}

impl<'info> ValidateAsset<'info> for MplCoreShared<'info> {
    fn validate_asset(&self, _mint: Option<AccountInfo<'info>>) -> Result<AmmAsset> {
        validate_asset(
            &self.asset.to_account_info(),
            self.collection
                .as_ref()
                .map(|a| a.to_account_info())
                .as_ref(),
        )?;

        let asset = BaseAssetV1::try_from(self.asset.as_ref())?;

        // Fetch the verified creators from the MPL Core asset and map into the expected type.
        let creators: Option<Vec<Creator>> = fetch_plugin::<BaseAssetV1, VerifiedCreators>(
            &self.asset.to_account_info(),
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

        Ok(AmmAsset {
            pubkey: self.asset.key(),
            collection,
            creators,
        })
    }
}

impl<'info> TradeShared<'info> {
    pub fn verify_whitelist(
        &self,
        standard: &impl ValidateAsset<'info>,
        mint: Option<AccountInfo<'info>>,
    ) -> Result<()> {
        let whitelist = unwrap_opt!(self.whitelist.as_ref(), ErrorCode::BadWhitelist);

        let asset = standard.validate_asset(mint)?;

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(whitelist, &asset.pubkey, mint_proof)?;

            let leaf = keccak::hash(asset.pubkey.as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(&asset.collection, &asset.creators, &full_merkle_proof)
    }

    pub fn close_pool_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        pool_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: pool_ta,
                destination: self.taker.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    pub fn close_taker_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        taker_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: taker_ta,
                destination: self.taker.to_account_info(),
                authority: self.taker.to_account_info(),
            },
        )
    }
}

impl<'info> TransferShared<'info> {
    pub fn verify_whitelist(
        &self,
        standard: &impl ValidateAsset<'info>,
        mint: Option<AccountInfo<'info>>,
    ) -> Result<()> {
        let whitelist = unwrap_opt!(self.whitelist.as_ref(), ErrorCode::BadWhitelist);

        let asset = standard.validate_asset(mint)?;

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(whitelist, &asset.pubkey, mint_proof)?;

            let leaf = keccak::hash(asset.pubkey.as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        whitelist.verify(&asset.collection, &asset.creators, &full_merkle_proof)
    }

    pub fn close_pool_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        pool_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: pool_ta,
                destination: self.owner.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }

    pub fn close_owner_ata_ctx(
        &self,
        token_program: AccountInfo<'info>,
        owner_ta: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            token_program,
            CloseAccount {
                account: owner_ta,
                destination: self.owner.to_account_info(),
                authority: self.owner.to_account_info(),
            },
        )
    }
}
