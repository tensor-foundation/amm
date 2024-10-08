//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! <https://github.com/kinobi-so/kinobi>
//!

use crate::generated::types::TaggedPayload;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Local version of `AuthorizationData` for IDL export.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct AuthorizationDataLocal {
    pub payload: Vec<TaggedPayload>,
}
