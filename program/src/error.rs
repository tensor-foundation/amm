//! Errors that can be returned by the program.
use anchor_lang::prelude::*;

/// All the errors that can be returned by the program.
#[error_code]
pub enum ErrorCode {
    #[msg("wrong whitelist")]
    WrongWhitelist = 6000,

    #[msg("operation not permitted on this pool type")]
    WrongPoolType,

    #[msg("fees entered above allowed threshold")]
    FeesTooHigh,

    #[msg("delta too large")]
    DeltaTooLarge,

    #[msg("arithmetic error")]
    ArithmeticError,

    #[msg("specified price not within current price")]
    PriceMismatch,

    #[msg("cannot close pool with nfts in escrow -- withdraw all before closing")]
    ExistingNfts,

    #[msg("fees not allowed for non-trade pools")]
    FeesNotAllowed,

    #[msg("wrong pool version provided")]
    WrongPoolVersion,

    #[msg("bad mint proof account")]
    BadMintProof,

    #[msg("wrong cosigner")]
    WrongCosigner,

    #[msg("bad shared escrow account")]
    BadSharedEscrow,

    #[msg("expected a non-shared escrow pool to be passed in")]
    PoolOnSharedEscrow,

    #[msg("cannot use shared escrow in NFT pools")]
    CannotUseSharedEscrow,

    #[msg("max taker sell count exceeded, pool cannot buy anymore NFTs")]
    MaxTakerSellCountExceeded,

    #[msg("max taker sell count is too small")]
    MaxTakerSellCountTooSmall,

    #[msg("starting price can't be smaller than 1 lamport")]
    StartingPriceTooSmall,

    #[msg("Pool must keep minimum rent balance")]
    PoolInsufficientRent,

    #[msg("Wrong rent payer")]
    WrongRentPayer,

    #[msg("Expiry too large")]
    ExpiryTooLarge,

    #[msg("Expired Pool")]
    ExpiredPool,

    #[msg("Pool not expired")]
    PoolNotExpired,

    #[msg("Invalid pool amount")]
    InvalidPoolAmount,

    #[msg("Wrong maker broker account")]
    WrongMakerBroker,

    #[msg("Wrong owner")]
    WrongOwner,

    #[msg("Escrow program not set")]
    EscrowProgramNotSet,

    #[msg("Missing maker broker account")]
    MissingMakerBroker,

    #[msg("Missing cosigner account")]
    MissingCosigner,
}
