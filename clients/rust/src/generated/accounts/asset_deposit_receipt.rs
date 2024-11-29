//! This code was AUTOGENERATED using the codama library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun codama to update it.
//!
//! <https://github.com/codama-idl/codama>
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

/// Represents Assets deposited into a Trade or NFT pool.
/// Seeds: "nft_receipt", asset, pool
/// Dummy struct to allow Kinobi to generate the PDA seeds.
/// This is the deposit receipt for NFT standards that have "asset" addresses instead of "mint" addresses.

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct AssetDepositReceipt {
    pub discriminator: [u8; 8],
    pub bump: u8,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub asset: Pubkey,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub pool: Pubkey,
}

impl AssetDepositReceipt {
    pub const LEN: usize = 73;

    /// Prefix values used to generate a PDA for this account.
    ///
    /// Values are positional and appear in the following order:
    ///
    ///   0. `AssetDepositReceipt::PREFIX`
    ///   1. asset (`Pubkey`)
    ///   2. pool (`Pubkey`)
    pub const PREFIX: &'static [u8] = "nft_receipt".as_bytes();

    pub fn create_pda(
        asset: Pubkey,
        pool: Pubkey,
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &[
                "nft_receipt".as_bytes(),
                asset.as_ref(),
                pool.as_ref(),
                &[bump],
            ],
            &crate::TENSOR_AMM_ID,
        )
    }

    pub fn find_pda(asset: &Pubkey, pool: &Pubkey) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &["nft_receipt".as_bytes(), asset.as_ref(), pool.as_ref()],
            &crate::TENSOR_AMM_ID,
        )
    }

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for AssetDepositReceipt {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}

#[cfg(feature = "anchor")]
impl anchor_lang::AccountDeserialize for AssetDepositReceipt {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        Ok(Self::deserialize(buf)?)
    }
}

#[cfg(feature = "anchor")]
impl anchor_lang::AccountSerialize for AssetDepositReceipt {}

#[cfg(feature = "anchor")]
impl anchor_lang::Owner for AssetDepositReceipt {
    fn owner() -> Pubkey {
        crate::TENSOR_AMM_ID
    }
}

#[cfg(feature = "anchor-idl-build")]
impl anchor_lang::IdlBuild for AssetDepositReceipt {}

#[cfg(feature = "anchor-idl-build")]
impl anchor_lang::Discriminator for AssetDepositReceipt {
    const DISCRIMINATOR: [u8; 8] = [0; 8];
}
