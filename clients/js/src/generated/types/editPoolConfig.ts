/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  combineCodec,
  getBooleanDecoder,
  getBooleanEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/web3.js';
import {
  getCurveTypeDecoder,
  getCurveTypeEncoder,
  type CurveType,
  type CurveTypeArgs,
} from '.';
import {
  getNullableU16Decoder,
  getNullableU16Encoder,
  type NullableU16,
  type NullableU16Args,
} from '../../hooked';

export type EditPoolConfig = {
  curveType: CurveType;
  startingPrice: bigint;
  delta: bigint;
  mmCompoundFees: boolean;
  mmFeeBps: NullableU16;
};

export type EditPoolConfigArgs = {
  curveType: CurveTypeArgs;
  startingPrice: number | bigint;
  delta: number | bigint;
  mmCompoundFees: boolean;
  mmFeeBps: NullableU16Args;
};

export function getEditPoolConfigEncoder(): Encoder<EditPoolConfigArgs> {
  return getStructEncoder([
    ['curveType', getCurveTypeEncoder()],
    ['startingPrice', getU64Encoder()],
    ['delta', getU64Encoder()],
    ['mmCompoundFees', getBooleanEncoder()],
    ['mmFeeBps', getNullableU16Encoder()],
  ]);
}

export function getEditPoolConfigDecoder(): Decoder<EditPoolConfig> {
  return getStructDecoder([
    ['curveType', getCurveTypeDecoder()],
    ['startingPrice', getU64Decoder()],
    ['delta', getU64Decoder()],
    ['mmCompoundFees', getBooleanDecoder()],
    ['mmFeeBps', getNullableU16Decoder()],
  ]);
}

export function getEditPoolConfigCodec(): Codec<
  EditPoolConfigArgs,
  EditPoolConfig
> {
  return combineCodec(getEditPoolConfigEncoder(), getEditPoolConfigDecoder());
}
