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

export enum TakerSide {
  Buy,
  Sell,
}

export type TakerSideArgs = TakerSide;

export function getTakerSideEncoder(): Encoder<TakerSideArgs> {
  return getScalarEnumEncoder(TakerSide);
}

export function getTakerSideDecoder(): Decoder<TakerSide> {
  return getScalarEnumDecoder(TakerSide);
}

export function getTakerSideCodec(): Codec<TakerSideArgs, TakerSide> {
  return combineCodec(getTakerSideEncoder(), getTakerSideDecoder());
}
