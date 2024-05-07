/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Account,
  EncodedAccount,
  FetchAccountConfig,
  FetchAccountsConfig,
  MaybeAccount,
  MaybeEncodedAccount,
  assertAccountExists,
  assertAccountsExist,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
} from '@solana/accounts';
import {
  Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/addresses';
import {
  Codec,
  Decoder,
  Encoder,
  combineCodec,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getI32Decoder,
  getI32Encoder,
  getI64Decoder,
  getI64Encoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  mapEncoder,
} from '@solana/codecs';
import {
  Currency,
  CurrencyArgs,
  NullableAddress,
  NullableAddressArgs,
  getCurrencyDecoder,
  getCurrencyEncoder,
  getNullableAddressDecoder,
  getNullableAddressEncoder,
} from '../../hooked';
import { PoolSeeds, findPoolPda } from '../pdas';
import {
  PoolConfig,
  PoolConfigArgs,
  PoolStats,
  PoolStatsArgs,
  getPoolConfigDecoder,
  getPoolConfigEncoder,
  getPoolStatsDecoder,
  getPoolStatsEncoder,
} from '../types';

export type Pool<TAddress extends string = string> = Account<
  PoolAccountData,
  TAddress
>;

export type MaybePool<TAddress extends string = string> = MaybeAccount<
  PoolAccountData,
  TAddress
>;

export type PoolAccountData = {
  discriminator: Array<number>;
  /** Pool version, used to control upgrades. */
  version: number;
  /** Bump seed for the pool PDA. */
  bump: Array<number>;
  /** Owner-chosen identifier for the pool */
  poolId: Uint8Array;
  /** Unix timestamp of the pool creation, in seconds. */
  createdAt: bigint;
  /** Unix timestamp of the last time the pool has been updated, in seconds. */
  updatedAt: bigint;
  /** Unix timestamp of when the pool expires, in seconds. */
  expiry: bigint;
  owner: Address;
  whitelist: Address;
  rentPayer: Address;
  currency: Currency;
  /** The amount of currency held in the pool */
  amount: bigint;
  /**
   * The difference between the number of buys and sells
   * where a postive number indicates the taker has BOUGHT more NFTs than sold
   * and a negative number indicates the taker has SOLD more NFTs than bought.
   * This is used to calculate the current price of the pool.
   */
  priceOffset: number;
  nftsHeld: number;
  stats: PoolStats;
  /** If an escrow account is present, means it's a shared-escrow pool. */
  sharedEscrow: NullableAddress;
  /** Offchain actor signs off to make sure an offchain condition is met (eg trait present). */
  cosigner: NullableAddress;
  /** Maker broker fees will be sent to this address if populated. */
  makerBroker: NullableAddress;
  /** Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinity. */
  maxTakerSellCount: number;
  config: PoolConfig;
  reserved: Array<number>;
};

export type PoolAccountDataArgs = {
  /** Pool version, used to control upgrades. */
  version: number;
  /** Bump seed for the pool PDA. */
  bump: Array<number>;
  /** Owner-chosen identifier for the pool */
  poolId: Uint8Array;
  /** Unix timestamp of the pool creation, in seconds. */
  createdAt: number | bigint;
  /** Unix timestamp of the last time the pool has been updated, in seconds. */
  updatedAt: number | bigint;
  /** Unix timestamp of when the pool expires, in seconds. */
  expiry: number | bigint;
  owner: Address;
  whitelist: Address;
  rentPayer: Address;
  currency: CurrencyArgs;
  /** The amount of currency held in the pool */
  amount: number | bigint;
  /**
   * The difference between the number of buys and sells
   * where a postive number indicates the taker has BOUGHT more NFTs than sold
   * and a negative number indicates the taker has SOLD more NFTs than bought.
   * This is used to calculate the current price of the pool.
   */
  priceOffset: number;
  nftsHeld: number;
  stats: PoolStatsArgs;
  /** If an escrow account is present, means it's a shared-escrow pool. */
  sharedEscrow: NullableAddressArgs;
  /** Offchain actor signs off to make sure an offchain condition is met (eg trait present). */
  cosigner: NullableAddressArgs;
  /** Maker broker fees will be sent to this address if populated. */
  makerBroker: NullableAddressArgs;
  /** Limit how many buys a pool can execute - useful for shared escrow pools, else keeps buying into infinity. */
  maxTakerSellCount: number;
  config: PoolConfigArgs;
  reserved: Array<number>;
};

export function getPoolAccountDataEncoder(): Encoder<PoolAccountDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['version', getU8Encoder()],
      ['bump', getArrayEncoder(getU8Encoder(), { size: 1 })],
      ['poolId', getBytesEncoder({ size: 32 })],
      ['createdAt', getI64Encoder()],
      ['updatedAt', getI64Encoder()],
      ['expiry', getI64Encoder()],
      ['owner', getAddressEncoder()],
      ['whitelist', getAddressEncoder()],
      ['rentPayer', getAddressEncoder()],
      ['currency', getCurrencyEncoder()],
      ['amount', getU64Encoder()],
      ['priceOffset', getI32Encoder()],
      ['nftsHeld', getU32Encoder()],
      ['stats', getPoolStatsEncoder()],
      ['sharedEscrow', getNullableAddressEncoder()],
      ['cosigner', getNullableAddressEncoder()],
      ['makerBroker', getNullableAddressEncoder()],
      ['maxTakerSellCount', getU32Encoder()],
      ['config', getPoolConfigEncoder()],
      ['reserved', getArrayEncoder(getU8Encoder(), { size: 100 })],
    ]),
    (value) => ({
      ...value,
      discriminator: [241, 154, 109, 4, 17, 177, 109, 188],
    })
  );
}

export function getPoolAccountDataDecoder(): Decoder<PoolAccountData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['version', getU8Decoder()],
    ['bump', getArrayDecoder(getU8Decoder(), { size: 1 })],
    ['poolId', getBytesDecoder({ size: 32 })],
    ['createdAt', getI64Decoder()],
    ['updatedAt', getI64Decoder()],
    ['expiry', getI64Decoder()],
    ['owner', getAddressDecoder()],
    ['whitelist', getAddressDecoder()],
    ['rentPayer', getAddressDecoder()],
    ['currency', getCurrencyDecoder()],
    ['amount', getU64Decoder()],
    ['priceOffset', getI32Decoder()],
    ['nftsHeld', getU32Decoder()],
    ['stats', getPoolStatsDecoder()],
    ['sharedEscrow', getNullableAddressDecoder()],
    ['cosigner', getNullableAddressDecoder()],
    ['makerBroker', getNullableAddressDecoder()],
    ['maxTakerSellCount', getU32Decoder()],
    ['config', getPoolConfigDecoder()],
    ['reserved', getArrayDecoder(getU8Decoder(), { size: 100 })],
  ]);
}

export function getPoolAccountDataCodec(): Codec<
  PoolAccountDataArgs,
  PoolAccountData
> {
  return combineCodec(getPoolAccountDataEncoder(), getPoolAccountDataDecoder());
}

export function decodePool<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Pool<TAddress>;
export function decodePool<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybePool<TAddress>;
export function decodePool<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
): Pool<TAddress> | MaybePool<TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getPoolAccountDataDecoder()
  );
}

export async function fetchPool<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Pool<TAddress>> {
  const maybeAccount = await fetchMaybePool(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybePool<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybePool<TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodePool(maybeAccount);
}

export async function fetchAllPool(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Pool[]> {
  const maybeAccounts = await fetchAllMaybePool(rpc, addresses, config);
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybePool(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybePool[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) => decodePool(maybeAccount));
}

export async function fetchPoolFromSeeds(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  seeds: PoolSeeds,
  config: FetchAccountConfig & { programAddress?: Address } = {}
): Promise<Pool> {
  const maybeAccount = await fetchMaybePoolFromSeeds(rpc, seeds, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybePoolFromSeeds(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  seeds: PoolSeeds,
  config: FetchAccountConfig & { programAddress?: Address } = {}
): Promise<MaybePool> {
  const { programAddress, ...fetchConfig } = config;
  const [address] = await findPoolPda(seeds, { programAddress });
  return await fetchMaybePool(rpc, address, fetchConfig);
}
