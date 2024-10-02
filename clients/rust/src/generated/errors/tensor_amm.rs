//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! <https://github.com/kinobi-so/kinobi>
//!

use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum TensorAmmError {
    /// 12000 - invalid merkle proof, token not whitelisted
    #[error("invalid merkle proof, token not whitelisted")]
    InvalidProof = 0x2EE0,
    /// 12001 - whitelist not verified -- currently only verified pools supported
    #[error("whitelist not verified -- currently only verified pools supported")]
    WhitelistNotVerified = 0x2EE1,
    /// 12002 - unexpected whitelist address
    #[error("unexpected whitelist address")]
    BadWhitelist = 0x2EE2,
    /// 12003 - operation not permitted on this pool type
    #[error("operation not permitted on this pool type")]
    WrongPoolType = 0x2EE3,
    /// 12004 - fee account doesn't match that stored on pool
    #[error("fee account doesn't match that stored on pool")]
    BadFeeAccount = 0x2EE4,
    /// 12005 - escrow account doesn't match that stored on pool
    #[error("escrow account doesn't match that stored on pool")]
    BadEscrowAccount = 0x2EE5,
    /// 12006 - when setting up a Trade pool, must provide fee bps
    #[error("when setting up a Trade pool, must provide fee bps")]
    MissingFees = 0x2EE6,
    /// 12007 - fees entered above allowed threshold
    #[error("fees entered above allowed threshold")]
    FeesTooHigh = 0x2EE7,
    /// 12008 - delta too large
    #[error("delta too large")]
    DeltaTooLarge = 0x2EE8,
    /// 12009 - arithmetic error
    #[error("arithmetic error")]
    ArithmeticError = 0x2EE9,
    /// 12010 - this nft doesnt belong to this pool
    #[error("this nft doesnt belong to this pool")]
    WrongPool = 0x2EEA,
    /// 12011 - royalties are enabled always
    #[error("royalties are enabled always")]
    RoyaltiesEnabled = 0x2EEB,
    /// 12012 - specified price not within current price
    #[error("specified price not within current price")]
    PriceMismatch = 0x2EEC,
    /// 12013 - cannot close pool with nfts in escrow -- withdraw all before closing
    #[error("cannot close pool with nfts in escrow -- withdraw all before closing")]
    ExistingNfts = 0x2EED,
    /// 12014 - wrong mint passed for provided accounts
    #[error("wrong mint passed for provided accounts")]
    WrongMint = 0x2EEE,
    /// 12015 - insufficient Tswap account balance
    #[error("insufficient Tswap account balance")]
    InsufficientTswapAccBalance = 0x2EEF,
    /// 12016 - bad owner
    #[error("bad owner")]
    BadOwner = 0x2EF0,
    /// 12017 - fees not allowed for non-trade pools
    #[error("fees not allowed for non-trade pools")]
    FeesNotAllowed = 0x2EF1,
    /// 12018 - metadata account does not match
    #[error("metadata account does not match")]
    BadMetadata = 0x2EF2,
    /// 12019 - provided creator address does not match metadata creator
    #[error("provided creator address does not match metadata creator")]
    CreatorMismatch = 0x2EF3,
    /// 12020 - wrong pool version provided
    #[error("wrong pool version provided")]
    WrongPoolVersion = 0x2EF4,
    /// 12021 - new pool should not match old pool
    #[error("new pool should not match old pool")]
    PoolsAreTheSame = 0x2EF5,
    /// 12022 - wrong nft authority account provided
    #[error("wrong nft authority account provided")]
    WrongAuthority = 0x2EF6,
    /// 12023 - amount frozen doesnt match current price
    #[error("amount frozen doesnt match current price")]
    FrozenAmountMismatch = 0x2EF7,
    /// 12024 - mint proof account does not match
    #[error("mint proof account does not match")]
    BadMintProof = 0x2EF8,
    /// 12025 - bad cosigner passed - either wrong key or no signature
    #[error("bad cosigner passed - either wrong key or no signature")]
    BadCosigner = 0x2EF9,
    /// 12026 - pool is frozen and cannot execute normal operations
    #[error("pool is frozen and cannot execute normal operations")]
    PoolFrozen = 0x2EFA,
    /// 12027 - bad shared escrow account passed
    #[error("bad shared escrow account passed")]
    BadSharedEscrow = 0x2EFB,
    /// 12028 - expected a shared escrow pool to be passed in
    #[error("expected a shared escrow pool to be passed in")]
    PoolNotOnSharedEscrow = 0x2EFC,
    /// 12029 - expected a non-shared escrow pool to be passed in
    #[error("expected a non-shared escrow pool to be passed in")]
    PoolOnSharedEscrow = 0x2EFD,
    /// 12030 - wrong order type
    #[error("wrong order type")]
    WrongOrderType = 0x2EFE,
    /// 12031 - wrong frozen status
    #[error("wrong frozen status")]
    WrongFrozenStatus = 0x2EFF,
    /// 12032 - shared escrow account has pools open and is in use
    #[error("shared escrow account has pools open and is in use")]
    SharedEscrowInUse = 0x2F00,
    /// 12033 - max taker sell count exceeded, pool cannot buy anymore NFTs
    #[error("max taker sell count exceeded, pool cannot buy anymore NFTs")]
    MaxTakerSellCountExceeded = 0x2F01,
    /// 12034 - max taker sell count is too small
    #[error("max taker sell count is too small")]
    MaxTakerSellCountTooSmall = 0x2F02,
    /// 12035 - rule set for programmable nft does not match
    #[error("rule set for programmable nft does not match")]
    BadRuleSet = 0x2F03,
    /// 12036 - this pool compounds fees and they cannot be withdrawn separately
    #[error("this pool compounds fees and they cannot be withdrawn separately")]
    PoolFeesCompounded = 0x2F04,
    /// 12037 - royalties percentage passed in must be between 0 and 100
    #[error("royalties percentage passed in must be between 0 and 100")]
    BadRoyaltiesPct = 0x2F05,
    /// 12038 - starting price can't be smaller than 1 lamport
    #[error("starting price can't be smaller than 1 lamport")]
    StartingPriceTooSmall = 0x2F06,
    /// 12039 - Pool must keep minimum rent balance
    #[error("Pool must keep minimum rent balance")]
    PoolKeepAlive = 0x2F07,
    /// 12040 - Wrong rent payer
    #[error("Wrong rent payer")]
    WrongRentPayer = 0x2F08,
    /// 12041 - SPL tokens not supported
    #[error("SPL tokens not supported")]
    SplTokensNotSupported = 0x2F09,
    /// 12042 - Expiry too large
    #[error("Expiry too large")]
    ExpiryTooLarge = 0x2F0A,
    /// 12043 - Expired Pool
    #[error("Expired Pool")]
    ExpiredPool = 0x2F0B,
    /// 12044 - Pool not expired
    #[error("Pool not expired")]
    PoolNotExpired = 0x2F0C,
    /// 12045 - Unsupported currency
    #[error("Unsupported currency")]
    UnsupportedCurrency = 0x2F0D,
    /// 12046 - Invalid pool amount
    #[error("Invalid pool amount")]
    InvalidPoolAmount = 0x2F0E,
    /// 12047 - Wrong maker broker account
    #[error("Wrong maker broker account")]
    WrongMakerBroker = 0x2F0F,
    /// 12048 - Wrong rent payer
    #[error("Wrong rent payer")]
    WrongOwner = 0x2F10,
    /// 12049 - Escrow program not set
    #[error("Escrow program not set")]
    EscrowProgramNotSet = 0x2F11,
    /// 12050 - Mint proof not set
    #[error("Mint proof not set")]
    MintProofNotSet = 0x2F12,
    /// 12051 - Missing maker broker account
    #[error("Missing maker broker account")]
    MissingMakerBroker = 0x2F13,
    /// 12052 - Missing cosigner account
    #[error("Missing cosigner account")]
    MissingCosigner = 0x2F14,
    /// 12053 - Wrong cosigner account
    #[error("Wrong cosigner account")]
    WrongCosigner = 0x2F15,
}

impl solana_program::program_error::PrintProgramError for TensorAmmError {
    fn print<E>(&self) {
        solana_program::msg!(&self.to_string());
    }
}
