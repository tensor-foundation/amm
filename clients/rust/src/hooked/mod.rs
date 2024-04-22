use std::ops::Deref;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct NullableAddress(Pubkey);

impl NullableAddress {
    pub fn to_option(&self) -> Option<Pubkey> {
        if self.0 == Pubkey::default() {
            None
        } else {
            Some(self.0)
        }
    }
}

pub type NullableU16 = NullableNumber<u16>;
pub type NullableU64 = NullableNumber<u64>;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct NullableNumber<T: BorshSerialize + BorshDeserialize + Default + PartialEq>(T);

impl<T: BorshSerialize + BorshDeserialize + Default + PartialEq> NullableNumber<T> {
    pub fn to_option(&self) -> Option<&T> {
        if self.0 == T::default() {
            None
        } else {
            Some(&self.0)
        }
    }

    pub fn none() -> Self {
        Self(T::default())
    }
}

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
