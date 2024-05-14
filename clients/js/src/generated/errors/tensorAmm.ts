/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

export const enum TensorAmmProgramErrorCode {
  /** InvalidProof: invalid merkle proof, token not whitelisted */
  INVALID_PROOF = 0x2ee0, // 12000
  /** WhitelistNotVerified: whitelist not verified -- currently only verified pools supported */
  WHITELIST_NOT_VERIFIED = 0x2ee1, // 12001
  /** BadWhitelist: unexpected whitelist address */
  BAD_WHITELIST = 0x2ee2, // 12002
  /** WrongPoolType: operation not permitted on this pool type */
  WRONG_POOL_TYPE = 0x2ee3, // 12003
  /** BadFeeAccount: fee account doesn't match that stored on pool */
  BAD_FEE_ACCOUNT = 0x2ee4, // 12004
  /** BadEscrowAccount: escrow account doesn't match that stored on pool */
  BAD_ESCROW_ACCOUNT = 0x2ee5, // 12005
  /** MissingFees: when setting up a Trade pool, must provide fee bps */
  MISSING_FEES = 0x2ee6, // 12006
  /** FeesTooHigh: fees entered above allowed threshold */
  FEES_TOO_HIGH = 0x2ee7, // 12007
  /** DeltaTooLarge: delta too large */
  DELTA_TOO_LARGE = 0x2ee8, // 12008
  /** ArithmeticError: arithmetic error */
  ARITHMETIC_ERROR = 0x2ee9, // 12009
  /** WrongPool: this nft doesnt belong to this pool */
  WRONG_POOL = 0x2eea, // 12010
  /** RoyaltiesEnabled: royalties are enabled always */
  ROYALTIES_ENABLED = 0x2eeb, // 12011
  /** PriceMismatch: specified price not within current price */
  PRICE_MISMATCH = 0x2eec, // 12012
  /** ExistingNfts: cannot close pool with nfts in escrow -- withdraw all before closing */
  EXISTING_NFTS = 0x2eed, // 12013
  /** WrongMint: wrong mint passed for provided accounts */
  WRONG_MINT = 0x2eee, // 12014
  /** InsufficientTswapAccBalance: insufficient Tswap account balance */
  INSUFFICIENT_TSWAP_ACC_BALANCE = 0x2eef, // 12015
  /** BadOwner: bad owner */
  BAD_OWNER = 0x2ef0, // 12016
  /** FeesNotAllowed: fees not allowed for non-trade pools */
  FEES_NOT_ALLOWED = 0x2ef1, // 12017
  /** BadMetadata: metadata account does not match */
  BAD_METADATA = 0x2ef2, // 12018
  /** CreatorMismatch: provided creator address does not match metadata creator */
  CREATOR_MISMATCH = 0x2ef3, // 12019
  /** WrongPoolVersion: wrong pool version provided */
  WRONG_POOL_VERSION = 0x2ef4, // 12020
  /** PoolsAreTheSame: new pool should not match old pool */
  POOLS_ARE_THE_SAME = 0x2ef5, // 12021
  /** WrongAuthority: wrong nft authority account provided */
  WRONG_AUTHORITY = 0x2ef6, // 12022
  /** FrozenAmountMismatch: amount frozen doesnt match current price */
  FROZEN_AMOUNT_MISMATCH = 0x2ef7, // 12023
  /** BadMintProof: mint proof account does not match */
  BAD_MINT_PROOF = 0x2ef8, // 12024
  /** BadCosigner: bad cosigner passed - either wrong key or no signature */
  BAD_COSIGNER = 0x2ef9, // 12025
  /** PoolFrozen: pool is frozen and cannot execute normal operations */
  POOL_FROZEN = 0x2efa, // 12026
  /** BadSharedEscrow: bad shared escrow account passed */
  BAD_SHARED_ESCROW = 0x2efb, // 12027
  /** PoolNotOnSharedEscrow: expected a shared escrow pool to be passed in */
  POOL_NOT_ON_SHARED_ESCROW = 0x2efc, // 12028
  /** PoolOnSharedEscrow: expected a non-shared escrow pool to be passed in */
  POOL_ON_SHARED_ESCROW = 0x2efd, // 12029
  /** WrongOrderType: wrong order type */
  WRONG_ORDER_TYPE = 0x2efe, // 12030
  /** WrongFrozenStatus: wrong frozen status */
  WRONG_FROZEN_STATUS = 0x2eff, // 12031
  /** SharedEscrowInUse: shared escrow account has pools open and is in use */
  SHARED_ESCROW_IN_USE = 0x2f00, // 12032
  /** MaxTakerSellCountExceeded: max taker sell count exceeded, pool cannot buy anymore NFTs */
  MAX_TAKER_SELL_COUNT_EXCEEDED = 0x2f01, // 12033
  /** MaxTakerSellCountTooSmall: max taker sell count is too small */
  MAX_TAKER_SELL_COUNT_TOO_SMALL = 0x2f02, // 12034
  /** BadRuleSet: rule set for programmable nft does not match */
  BAD_RULE_SET = 0x2f03, // 12035
  /** PoolFeesCompounded: this pool compounds fees and they cannot be withdrawn separately */
  POOL_FEES_COMPOUNDED = 0x2f04, // 12036
  /** BadRoyaltiesPct: royalties percentage passed in must be between 0 and 100 */
  BAD_ROYALTIES_PCT = 0x2f05, // 12037
  /** StartingPriceTooSmall: starting price can't be smaller than 1 lamport */
  STARTING_PRICE_TOO_SMALL = 0x2f06, // 12038
  /** PoolKeepAlive: Pool must keep minimum rent balance */
  POOL_KEEP_ALIVE = 0x2f07, // 12039
  /** WrongRentPayer: Wrong rent payer */
  WRONG_RENT_PAYER = 0x2f08, // 12040
  /** SplTokensNotSupported: SPL tokens not supported */
  SPL_TOKENS_NOT_SUPPORTED = 0x2f09, // 12041
  /** ExpiryTooLarge: Expiry too large */
  EXPIRY_TOO_LARGE = 0x2f0a, // 12042
  /** ExpiredPool: Expired Pool */
  EXPIRED_POOL = 0x2f0b, // 12043
  /** PoolNotExpired: Pool not expired */
  POOL_NOT_EXPIRED = 0x2f0c, // 12044
  /** UnsupportedCurrency: Unsupported currency */
  UNSUPPORTED_CURRENCY = 0x2f0d, // 12045
  /** InvalidPoolAmount: Invalid pool amount */
  INVALID_POOL_AMOUNT = 0x2f0e, // 12046
  /** WrongBrokerAccount: Wrong broker account */
  WRONG_BROKER_ACCOUNT = 0x2f0f, // 12047
  /** WrongOwner: Wrong rent payer */
  WRONG_OWNER = 0x2f10, // 12048
}

export class TensorAmmProgramError extends Error {
  override readonly name = 'TensorAmmProgramError';

  readonly code: TensorAmmProgramErrorCode;

  readonly cause: Error | undefined;

  constructor(
    code: TensorAmmProgramErrorCode,
    name: string,
    message: string,
    cause?: Error
  ) {
    super(`${name} (${code}): ${message}`);
    this.code = code;
    this.cause = cause;
  }
}

let tensorAmmProgramErrorCodeMap:
  | Record<TensorAmmProgramErrorCode, [string, string]>
  | undefined;
if (__DEV__) {
  tensorAmmProgramErrorCodeMap = {
    [TensorAmmProgramErrorCode.INVALID_PROOF]: [
      'InvalidProof',
      `invalid merkle proof, token not whitelisted`,
    ],
    [TensorAmmProgramErrorCode.WHITELIST_NOT_VERIFIED]: [
      'WhitelistNotVerified',
      `whitelist not verified -- currently only verified pools supported`,
    ],
    [TensorAmmProgramErrorCode.BAD_WHITELIST]: [
      'BadWhitelist',
      `unexpected whitelist address`,
    ],
    [TensorAmmProgramErrorCode.WRONG_POOL_TYPE]: [
      'WrongPoolType',
      `operation not permitted on this pool type`,
    ],
    [TensorAmmProgramErrorCode.BAD_FEE_ACCOUNT]: [
      'BadFeeAccount',
      `fee account doesn't match that stored on pool`,
    ],
    [TensorAmmProgramErrorCode.BAD_ESCROW_ACCOUNT]: [
      'BadEscrowAccount',
      `escrow account doesn't match that stored on pool`,
    ],
    [TensorAmmProgramErrorCode.MISSING_FEES]: [
      'MissingFees',
      `when setting up a Trade pool, must provide fee bps`,
    ],
    [TensorAmmProgramErrorCode.FEES_TOO_HIGH]: [
      'FeesTooHigh',
      `fees entered above allowed threshold`,
    ],
    [TensorAmmProgramErrorCode.DELTA_TOO_LARGE]: [
      'DeltaTooLarge',
      `delta too large`,
    ],
    [TensorAmmProgramErrorCode.ARITHMETIC_ERROR]: [
      'ArithmeticError',
      `arithmetic error`,
    ],
    [TensorAmmProgramErrorCode.WRONG_POOL]: [
      'WrongPool',
      `this nft doesnt belong to this pool`,
    ],
    [TensorAmmProgramErrorCode.ROYALTIES_ENABLED]: [
      'RoyaltiesEnabled',
      `royalties are enabled always`,
    ],
    [TensorAmmProgramErrorCode.PRICE_MISMATCH]: [
      'PriceMismatch',
      `specified price not within current price`,
    ],
    [TensorAmmProgramErrorCode.EXISTING_NFTS]: [
      'ExistingNfts',
      `cannot close pool with nfts in escrow -- withdraw all before closing`,
    ],
    [TensorAmmProgramErrorCode.WRONG_MINT]: [
      'WrongMint',
      `wrong mint passed for provided accounts`,
    ],
    [TensorAmmProgramErrorCode.INSUFFICIENT_TSWAP_ACC_BALANCE]: [
      'InsufficientTswapAccBalance',
      `insufficient Tswap account balance`,
    ],
    [TensorAmmProgramErrorCode.BAD_OWNER]: ['BadOwner', `bad owner`],
    [TensorAmmProgramErrorCode.FEES_NOT_ALLOWED]: [
      'FeesNotAllowed',
      `fees not allowed for non-trade pools`,
    ],
    [TensorAmmProgramErrorCode.BAD_METADATA]: [
      'BadMetadata',
      `metadata account does not match`,
    ],
    [TensorAmmProgramErrorCode.CREATOR_MISMATCH]: [
      'CreatorMismatch',
      `provided creator address does not match metadata creator`,
    ],
    [TensorAmmProgramErrorCode.WRONG_POOL_VERSION]: [
      'WrongPoolVersion',
      `wrong pool version provided`,
    ],
    [TensorAmmProgramErrorCode.POOLS_ARE_THE_SAME]: [
      'PoolsAreTheSame',
      `new pool should not match old pool`,
    ],
    [TensorAmmProgramErrorCode.WRONG_AUTHORITY]: [
      'WrongAuthority',
      `wrong nft authority account provided`,
    ],
    [TensorAmmProgramErrorCode.FROZEN_AMOUNT_MISMATCH]: [
      'FrozenAmountMismatch',
      `amount frozen doesnt match current price`,
    ],
    [TensorAmmProgramErrorCode.BAD_MINT_PROOF]: [
      'BadMintProof',
      `mint proof account does not match`,
    ],
    [TensorAmmProgramErrorCode.BAD_COSIGNER]: [
      'BadCosigner',
      `bad cosigner passed - either wrong key or no signature`,
    ],
    [TensorAmmProgramErrorCode.POOL_FROZEN]: [
      'PoolFrozen',
      `pool is frozen and cannot execute normal operations`,
    ],
    [TensorAmmProgramErrorCode.BAD_SHARED_ESCROW]: [
      'BadSharedEscrow',
      `bad shared escrow account passed`,
    ],
    [TensorAmmProgramErrorCode.POOL_NOT_ON_SHARED_ESCROW]: [
      'PoolNotOnSharedEscrow',
      `expected a shared escrow pool to be passed in`,
    ],
    [TensorAmmProgramErrorCode.POOL_ON_SHARED_ESCROW]: [
      'PoolOnSharedEscrow',
      `expected a non-shared escrow pool to be passed in`,
    ],
    [TensorAmmProgramErrorCode.WRONG_ORDER_TYPE]: [
      'WrongOrderType',
      `wrong order type`,
    ],
    [TensorAmmProgramErrorCode.WRONG_FROZEN_STATUS]: [
      'WrongFrozenStatus',
      `wrong frozen status`,
    ],
    [TensorAmmProgramErrorCode.SHARED_ESCROW_IN_USE]: [
      'SharedEscrowInUse',
      `shared escrow account has pools open and is in use`,
    ],
    [TensorAmmProgramErrorCode.MAX_TAKER_SELL_COUNT_EXCEEDED]: [
      'MaxTakerSellCountExceeded',
      `max taker sell count exceeded, pool cannot buy anymore NFTs`,
    ],
    [TensorAmmProgramErrorCode.MAX_TAKER_SELL_COUNT_TOO_SMALL]: [
      'MaxTakerSellCountTooSmall',
      `max taker sell count is too small`,
    ],
    [TensorAmmProgramErrorCode.BAD_RULE_SET]: [
      'BadRuleSet',
      `rule set for programmable nft does not match`,
    ],
    [TensorAmmProgramErrorCode.POOL_FEES_COMPOUNDED]: [
      'PoolFeesCompounded',
      `this pool compounds fees and they cannot be withdrawn separately`,
    ],
    [TensorAmmProgramErrorCode.BAD_ROYALTIES_PCT]: [
      'BadRoyaltiesPct',
      `royalties percentage passed in must be between 0 and 100`,
    ],
    [TensorAmmProgramErrorCode.STARTING_PRICE_TOO_SMALL]: [
      'StartingPriceTooSmall',
      `starting price can't be smaller than 1 lamport`,
    ],
    [TensorAmmProgramErrorCode.POOL_KEEP_ALIVE]: [
      'PoolKeepAlive',
      `Pool must keep minimum rent balance`,
    ],
    [TensorAmmProgramErrorCode.WRONG_RENT_PAYER]: [
      'WrongRentPayer',
      `Wrong rent payer`,
    ],
    [TensorAmmProgramErrorCode.SPL_TOKENS_NOT_SUPPORTED]: [
      'SplTokensNotSupported',
      `SPL tokens not supported`,
    ],
    [TensorAmmProgramErrorCode.EXPIRY_TOO_LARGE]: [
      'ExpiryTooLarge',
      `Expiry too large`,
    ],
    [TensorAmmProgramErrorCode.EXPIRED_POOL]: ['ExpiredPool', `Expired Pool`],
    [TensorAmmProgramErrorCode.POOL_NOT_EXPIRED]: [
      'PoolNotExpired',
      `Pool not expired`,
    ],
    [TensorAmmProgramErrorCode.UNSUPPORTED_CURRENCY]: [
      'UnsupportedCurrency',
      `Unsupported currency`,
    ],
    [TensorAmmProgramErrorCode.INVALID_POOL_AMOUNT]: [
      'InvalidPoolAmount',
      `Invalid pool amount`,
    ],
    [TensorAmmProgramErrorCode.WRONG_BROKER_ACCOUNT]: [
      'WrongBrokerAccount',
      `Wrong broker account`,
    ],
    [TensorAmmProgramErrorCode.WRONG_OWNER]: ['WrongOwner', `Wrong rent payer`],
  };
}

export function getTensorAmmProgramErrorFromCode(
  code: TensorAmmProgramErrorCode,
  cause?: Error
): TensorAmmProgramError {
  if (__DEV__) {
    return new TensorAmmProgramError(
      code,
      ...(
        tensorAmmProgramErrorCodeMap as Record<
          TensorAmmProgramErrorCode,
          [string, string]
        >
      )[code],
      cause
    );
  }

  return new TensorAmmProgramError(
    code,
    'Unknown',
    'Error message not available in production bundles. Compile with __DEV__ set to true to see more information.',
    cause
  );
}