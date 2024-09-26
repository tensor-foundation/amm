use std::fmt::{self, Display, Formatter};
use std::ops::Deref;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, Default, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Currency(Pubkey);

impl Deref for Currency {
    type Target = Pubkey;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Currency {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        if self.is_sol() {
            write!(f, "SOL")
        } else {
            write!(f, "{}", self.0)
        }
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
