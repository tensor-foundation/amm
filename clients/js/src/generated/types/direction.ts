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

export enum Direction {
  Up,
  Down,
}

export type DirectionArgs = Direction;

export function getDirectionEncoder() {
  return getScalarEnumEncoder(Direction) satisfies Encoder<DirectionArgs>;
}

export function getDirectionDecoder() {
  return getScalarEnumDecoder(Direction) satisfies Decoder<Direction>;
}

export function getDirectionCodec(): Codec<DirectionArgs, Direction> {
  return combineCodec(getDirectionEncoder(), getDirectionDecoder());
}
