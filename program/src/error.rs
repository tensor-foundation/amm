use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // 6000 | 0x1770
    #[msg("invalid merkle proof, token not whitelisted")]
    InvalidProof = 6000,

    // 6001 | 0x1771
    #[msg("whitelist not verified -- currently only verified pools supported")]
    WhitelistNotVerified = 6001,

    // 6002 | 0x1772
    #[msg("unexpected whitelist address")]
    BadWhitelist = 6002,

    // 6003 | 0x1773
    #[msg("operation not permitted on this pool type")]
    WrongPoolType = 6003,

    // 6004 | 0x1774
    #[msg("fee account doesn't match that stored on pool")]
    BadFeeAccount = 6004,

    // 6005 | 0x1775
    #[msg("escrow account doesn't match that stored on pool")]
    BadEscrowAccount = 6005,

    // 6006 | 0x1776
    #[msg("when setting up a Trade pool, must provide fee bps & fee vault")]
    MissingFees = 6006,

    // 6007 | 0x1777
    #[msg("fees entered above allowed threshold")]
    FeesTooHigh = 6007,

    // 6008 | 0x1778
    #[msg("delta too large")]
    DeltaTooLarge = 6008,

    // 6009 | 0x1779
    #[msg("arithmetic error")]
    ArithmeticError = 6009,

    // 6010 | 0x177a
    #[msg("this nft doesnt belong to this pool")]
    WrongPool = 6010,

    //@DEPRECATED
    // 6011 | 0x177b
    #[msg("royalties are enabled always")]
    RoyaltiesEnabled = 6011,

    // 6012 | 0x177c
    #[msg("specified price not within current price")]
    PriceMismatch = 6012,

    // 6013 | 0x177d
    #[msg("cannot close pool with nfts in escrow -- withdraw all before closing")]
    ExistingNfts = 6013,

    // 6014 | 0x177e
    #[msg("wrong mint passed for provided accounts")]
    WrongMint = 6014,

    // 6015 | 0x177f
    #[msg("insufficient Tswap account balance")]
    InsufficientTswapAccBalance = 6015,

    // 6016 | 0x1780
    #[msg("bad owner")]
    BadOwner = 6016,

    // 6017 | 0x1781
    #[msg("fees not allowed for non-trade pools")]
    FeesNotAllowed = 6017,

    // 6018 | 0x1782
    #[msg("metadata account does not match")]
    BadMetadata = 6018,

    //error copied from metaplex
    // 6019 | 0x1783
    #[msg("provided creator address does not match metadata creator")]
    CreatorMismatch = 6019,

    // 6020 | 0x1784
    #[msg("wrong pool version provided")]
    WrongPoolVersion = 6020,

    // 6021 | 0x1785
    #[msg("new pool should not match old pool")]
    PoolsAreTheSame = 6021,

    // 6022 | 0x1786
    #[msg("wrong nft authority account provided")]
    WrongAuthority = 6022,

    // 6023 | 0x1787
    #[msg("amount frozen doesnt match current price")]
    FrozenAmountMismatch = 6023,

    // 6024 | 0x1788
    #[msg("mint proof account does not match")]
    BadMintProof = 6024,

    // 6025 | 0x1789
    #[msg("bad cosigner passed - either wrong key or no signature")]
    BadCosigner = 6025,

    // 6026 | 0x178a
    #[msg("pool is frozen and cannot execute normal operations")]
    PoolFrozen = 6026,

    // 6027 | 0x178b
    #[msg("bad shared escrow account passed")]
    BadSharedEscrow = 6027,

    // 6028 | 0x178c
    #[msg("expected a shared escrow pool to be passed in")]
    PoolNotOnSharedEscrow = 6028,

    // 6029 | 0x178d
    #[msg("expected a non-shared escrow pool to be passed in")]
    PoolOnSharedEscrow = 6029,

    //note this is different to pool type - order type = standard/sniping/etc
    // 6030 | 0x178e
    #[msg("wrong order type")]
    WrongOrderType = 6030,

    // 6031 | 0x178f
    #[msg("wrong frozen status")]
    WrongFrozenStatus = 6031,

    // 6032 | 0x1790
    #[msg("shared escrow account has pools open and is in use")]
    SharedEscrowInUse = 6032,

    // 6033 | 0x1791
    #[msg("max taker sell count exceeded, pool cannot buy anymore NFTs")]
    MaxTakerSellCountExceeded = 6033,

    // 6034 | 0x1792
    #[msg("max taker sell count is too small")]
    MaxTakerSellCountTooSmall = 6034,

    // 6035 | 0x1793
    #[msg("rule set for programmable nft does not match")]
    BadRuleSet = 6035,

    // 6036 | 0x1794
    #[msg("this pool compounds fees and they cannot be withdrawn separately")]
    PoolFeesCompounded = 6036,

    // 6037 | 0x1795
    #[msg("royalties percentage passed in must be between 0 and 100")]
    BadRoyaltiesPct = 6037,

    // 6038 | 0x1796
    #[msg("starting price can't be smaller than 1 lamport")]
    StartingPriceTooSmall,

    // 6039 | 0x1797
    #[msg("Pool must keep minimum rent balance")]
    PoolKeepAlive,

    // 6040 | 0x1798
    #[msg("Wrong rent payer")]
    WrongRentPayer,

    // 6041 | 0x1799
    #[msg("SPL tokens not supported")]
    SplTokensNotSupported,

    // 6042 | 0x179a
    #[msg("Expiry too large")]
    ExpiryTooLarge,

    // 6043 | 0x179b
    #[msg("Expired Pool")]
    ExpiredPool,

    // 6044 | 0x179c
    #[msg("Pool not expired")]
    PoolNotExpired,

    // 6042 | 0x179a
    #[msg("Invalid fee crank")]
    InvalidFeeCrank,
}
