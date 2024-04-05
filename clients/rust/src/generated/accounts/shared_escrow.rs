//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SharedEscrow {
    pub discriminator: [u8; 8],
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub owner: Pubkey,
    pub name: [u8; 32],
    pub nr: u16,
    pub bump: [u8; 1],
    pub pools_attached: u32,
    #[cfg_attr(feature = "serde", serde(with = "serde_with::As::<serde_with::Bytes>"))]
    pub reserved: [u8; 64],
}

impl SharedEscrow {
    pub const LEN: usize = 143;

    /// Prefix values used to generate a PDA for this account.
    ///
    /// Values are positional and appear in the following order:
    ///
    ///   0. `SharedEscrow::PREFIX`
    ///   1. owner (`Pubkey`)
    ///   2. nr (`u16`)
    pub const PREFIX: &'static [u8] = "shared_escrow".as_bytes();

    pub fn create_pda(
        owner: Pubkey,
        nr: u16,
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &[
                "shared_escrow".as_bytes(),
                owner.as_ref(),
                nr.to_string().as_ref(),
                &[bump],
            ],
            &crate::AMM_ID,
        )
    }

    pub fn find_pda(owner: &Pubkey, nr: u16) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &[
                "shared_escrow".as_bytes(),
                owner.as_ref(),
                nr.to_string().as_ref(),
            ],
            &crate::AMM_ID,
        )
    }

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for SharedEscrow {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}
