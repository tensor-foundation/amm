use std::ops::Deref;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Default, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Currency(Pubkey);

impl Deref for Currency {
    type Target = Pubkey;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Currency {
    pub fn new(pubkey: Pubkey) -> Self {
        Self(pubkey)
    }

    pub fn sol() -> Self {
        Self::default()
    }

    pub fn is_sol(&self) -> bool {
        *self == Self::default()
    }
}
