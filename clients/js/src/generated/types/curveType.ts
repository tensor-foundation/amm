/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Codec, Decoder, Encoder, combineCodec } from '@solana/codecs-core';
import {
  getScalarEnumDecoder,
  getScalarEnumEncoder,
} from '@solana/codecs-data-structures';

export enum CurveType {
  Linear,
  Exponential,
}

export type CurveTypeArgs = CurveType;

export function getCurveTypeEncoder() {
  return getScalarEnumEncoder(CurveType) satisfies Encoder<CurveTypeArgs>;
}

export function getCurveTypeDecoder() {
  return getScalarEnumDecoder(CurveType) satisfies Decoder<CurveType>;
}

export function getCurveTypeCodec(): Codec<CurveTypeArgs, CurveType> {
  return combineCodec(getCurveTypeEncoder(), getCurveTypeDecoder());
}
