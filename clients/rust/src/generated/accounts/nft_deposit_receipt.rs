//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

/// Represents NFTs deposited into a Trade or NFT pool.
/// Seeds: "nft_receipt", mint, pool

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct NftDepositReceipt {
    pub discriminator: [u8; 8],
    pub bump: u8,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub mint: Pubkey,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub pool: Pubkey,
}

impl NftDepositReceipt {
    pub const LEN: usize = 73;

    /// Prefix values used to generate a PDA for this account.
    ///
    /// Values are positional and appear in the following order:
    ///
    ///   0. `NftDepositReceipt::PREFIX`
    ///   1. mint (`Pubkey`)
    ///   2. pool (`Pubkey`)
    pub const PREFIX: &'static [u8] = "nft_receipt".as_bytes();

    pub fn create_pda(
        mint: Pubkey,
        pool: Pubkey,
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &[
                "nft_receipt".as_bytes(),
                mint.as_ref(),
                pool.as_ref(),
                &[bump],
            ],
            &crate::AMM_ID,
        )
    }

    pub fn find_pda(mint: &Pubkey, pool: &Pubkey) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &["nft_receipt".as_bytes(), mint.as_ref(), pool.as_ref()],
            &crate::AMM_ID,
        )
    }

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for NftDepositReceipt {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}
