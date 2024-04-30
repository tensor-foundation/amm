//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum AmmError {
    /// 12000 (0x2EE0) - invalid merkle proof, token not whitelisted
    #[error("invalid merkle proof, token not whitelisted")]
    InvalidProof,
    /// 12001 (0x2EE1) - whitelist not verified -- currently only verified pools supported
    #[error("whitelist not verified -- currently only verified pools supported")]
    WhitelistNotVerified,
    /// 12002 (0x2EE2) - unexpected whitelist address
    #[error("unexpected whitelist address")]
    BadWhitelist,
    /// 12003 (0x2EE3) - operation not permitted on this pool type
    #[error("operation not permitted on this pool type")]
    WrongPoolType,
    /// 12004 (0x2EE4) - fee account doesn't match that stored on pool
    #[error("fee account doesn't match that stored on pool")]
    BadFeeAccount,
    /// 12005 (0x2EE5) - escrow account doesn't match that stored on pool
    #[error("escrow account doesn't match that stored on pool")]
    BadEscrowAccount,
    /// 12006 (0x2EE6) - when setting up a Trade pool, must provide fee bps
    #[error("when setting up a Trade pool, must provide fee bps")]
    MissingFees,
    /// 12007 (0x2EE7) - fees entered above allowed threshold
    #[error("fees entered above allowed threshold")]
    FeesTooHigh,
    /// 12008 (0x2EE8) - delta too large
    #[error("delta too large")]
    DeltaTooLarge,
    /// 12009 (0x2EE9) - arithmetic error
    #[error("arithmetic error")]
    ArithmeticError,
    /// 12010 (0x2EEA) - this nft doesnt belong to this pool
    #[error("this nft doesnt belong to this pool")]
    WrongPool,
    /// 12011 (0x2EEB) - royalties are enabled always
    #[error("royalties are enabled always")]
    RoyaltiesEnabled,
    /// 12012 (0x2EEC) - specified price not within current price
    #[error("specified price not within current price")]
    PriceMismatch,
    /// 12013 (0x2EED) - cannot close pool with nfts in escrow -- withdraw all before closing
    #[error("cannot close pool with nfts in escrow -- withdraw all before closing")]
    ExistingNfts,
    /// 12014 (0x2EEE) - wrong mint passed for provided accounts
    #[error("wrong mint passed for provided accounts")]
    WrongMint,
    /// 12015 (0x2EEF) - insufficient Tswap account balance
    #[error("insufficient Tswap account balance")]
    InsufficientTswapAccBalance,
    /// 12016 (0x2EF0) - bad owner
    #[error("bad owner")]
    BadOwner,
    /// 12017 (0x2EF1) - fees not allowed for non-trade pools
    #[error("fees not allowed for non-trade pools")]
    FeesNotAllowed,
    /// 12018 (0x2EF2) - metadata account does not match
    #[error("metadata account does not match")]
    BadMetadata,
    /// 12019 (0x2EF3) - provided creator address does not match metadata creator
    #[error("provided creator address does not match metadata creator")]
    CreatorMismatch,
    /// 12020 (0x2EF4) - wrong pool version provided
    #[error("wrong pool version provided")]
    WrongPoolVersion,
    /// 12021 (0x2EF5) - new pool should not match old pool
    #[error("new pool should not match old pool")]
    PoolsAreTheSame,
    /// 12022 (0x2EF6) - wrong nft authority account provided
    #[error("wrong nft authority account provided")]
    WrongAuthority,
    /// 12023 (0x2EF7) - amount frozen doesnt match current price
    #[error("amount frozen doesnt match current price")]
    FrozenAmountMismatch,
    /// 12024 (0x2EF8) - mint proof account does not match
    #[error("mint proof account does not match")]
    BadMintProof,
    /// 12025 (0x2EF9) - bad cosigner passed - either wrong key or no signature
    #[error("bad cosigner passed - either wrong key or no signature")]
    BadCosigner,
    /// 12026 (0x2EFA) - pool is frozen and cannot execute normal operations
    #[error("pool is frozen and cannot execute normal operations")]
    PoolFrozen,
    /// 12027 (0x2EFB) - bad shared escrow account passed
    #[error("bad shared escrow account passed")]
    BadSharedEscrow,
    /// 12028 (0x2EFC) - expected a shared escrow pool to be passed in
    #[error("expected a shared escrow pool to be passed in")]
    PoolNotOnSharedEscrow,
    /// 12029 (0x2EFD) - expected a non-shared escrow pool to be passed in
    #[error("expected a non-shared escrow pool to be passed in")]
    PoolOnSharedEscrow,
    /// 12030 (0x2EFE) - wrong order type
    #[error("wrong order type")]
    WrongOrderType,
    /// 12031 (0x2EFF) - wrong frozen status
    #[error("wrong frozen status")]
    WrongFrozenStatus,
    /// 12032 (0x2F00) - shared escrow account has pools open and is in use
    #[error("shared escrow account has pools open and is in use")]
    SharedEscrowInUse,
    /// 12033 (0x2F01) - max taker sell count exceeded, pool cannot buy anymore NFTs
    #[error("max taker sell count exceeded, pool cannot buy anymore NFTs")]
    MaxTakerSellCountExceeded,
    /// 12034 (0x2F02) - max taker sell count is too small
    #[error("max taker sell count is too small")]
    MaxTakerSellCountTooSmall,
    /// 12035 (0x2F03) - rule set for programmable nft does not match
    #[error("rule set for programmable nft does not match")]
    BadRuleSet,
    /// 12036 (0x2F04) - this pool compounds fees and they cannot be withdrawn separately
    #[error("this pool compounds fees and they cannot be withdrawn separately")]
    PoolFeesCompounded,
    /// 12037 (0x2F05) - royalties percentage passed in must be between 0 and 100
    #[error("royalties percentage passed in must be between 0 and 100")]
    BadRoyaltiesPct,
    /// 12038 (0x2F06) - starting price can't be smaller than 1 lamport
    #[error("starting price can't be smaller than 1 lamport")]
    StartingPriceTooSmall,
    /// 12039 (0x2F07) - Pool must keep minimum rent balance
    #[error("Pool must keep minimum rent balance")]
    PoolKeepAlive,
    /// 12040 (0x2F08) - Wrong rent payer
    #[error("Wrong rent payer")]
    WrongRentPayer,
    /// 12041 (0x2F09) - SPL tokens not supported
    #[error("SPL tokens not supported")]
    SplTokensNotSupported,
    /// 12042 (0x2F0A) - Expiry too large
    #[error("Expiry too large")]
    ExpiryTooLarge,
    /// 12043 (0x2F0B) - Expired Pool
    #[error("Expired Pool")]
    ExpiredPool,
    /// 12044 (0x2F0C) - Pool not expired
    #[error("Pool not expired")]
    PoolNotExpired,
    /// 12045 (0x2F0D) - Unsupported currency
    #[error("Unsupported currency")]
    UnsupportedCurrency,
    /// 12046 (0x2F0E) - Invalid pool amount
    #[error("Invalid pool amount")]
    InvalidPoolAmount,
}

impl solana_program::program_error::PrintProgramError for AmmError {
    fn print<E>(&self) {
        solana_program::msg!(&self.to_string());
    }
}
