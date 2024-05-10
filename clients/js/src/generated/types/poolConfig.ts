/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Codec,
  Decoder,
  Encoder,
  combineCodec,
  getBooleanDecoder,
  getBooleanEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
} from '@solana/codecs';
import {
  CurveType,
  CurveTypeArgs,
  PoolType,
  PoolTypeArgs,
  getCurveTypeDecoder,
  getCurveTypeEncoder,
  getPoolTypeDecoder,
  getPoolTypeEncoder,
} from '.';
import {
  NullableU16,
  NullableU16Args,
  getNullableU16Decoder,
  getNullableU16Encoder,
} from '../../hooked';

/** Configuration values for a pool define the type of pool, curve, and other parameters. */
export type PoolConfig = {
  poolType: PoolType;
  curveType: CurveType;
  startingPrice: bigint;
  delta: bigint;
  mmCompoundFees: boolean;
  mmFeeBps: NullableU16;
};

export type PoolConfigArgs = {
  poolType: PoolTypeArgs;
  curveType: CurveTypeArgs;
  startingPrice: number | bigint;
  delta: number | bigint;
  mmCompoundFees: boolean;
  mmFeeBps: NullableU16Args;
};

export function getPoolConfigEncoder(): Encoder<PoolConfigArgs> {
  return getStructEncoder([
    ['poolType', getPoolTypeEncoder()],
    ['curveType', getCurveTypeEncoder()],
    ['startingPrice', getU64Encoder()],
    ['delta', getU64Encoder()],
    ['mmCompoundFees', getBooleanEncoder()],
    ['mmFeeBps', getNullableU16Encoder()],
  ]);
}

export function getPoolConfigDecoder(): Decoder<PoolConfig> {
  return getStructDecoder([
    ['poolType', getPoolTypeDecoder()],
    ['curveType', getCurveTypeDecoder()],
    ['startingPrice', getU64Decoder()],
    ['delta', getU64Decoder()],
    ['mmCompoundFees', getBooleanDecoder()],
    ['mmFeeBps', getNullableU16Decoder()],
  ]);
}

export function getPoolConfigCodec(): Codec<PoolConfigArgs, PoolConfig> {
  return combineCodec(getPoolConfigEncoder(), getPoolConfigDecoder());
}
