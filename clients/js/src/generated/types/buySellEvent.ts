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
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
} from '@solana/codecs';

export type BuySellEvent = {
  currentPrice: bigint;
  takerFee: bigint;
  mmFee: bigint;
  creatorsFee: bigint;
};

export type BuySellEventArgs = {
  currentPrice: number | bigint;
  takerFee: number | bigint;
  mmFee: number | bigint;
  creatorsFee: number | bigint;
};

export function getBuySellEventEncoder(): Encoder<BuySellEventArgs> {
  return getStructEncoder([
    ['currentPrice', getU64Encoder()],
    ['takerFee', getU64Encoder()],
    ['mmFee', getU64Encoder()],
    ['creatorsFee', getU64Encoder()],
  ]);
}

export function getBuySellEventDecoder(): Decoder<BuySellEvent> {
  return getStructDecoder([
    ['currentPrice', getU64Decoder()],
    ['takerFee', getU64Decoder()],
    ['mmFee', getU64Decoder()],
    ['creatorsFee', getU64Decoder()],
  ]);
}

export function getBuySellEventCodec(): Codec<BuySellEventArgs, BuySellEvent> {
  return combineCodec(getBuySellEventEncoder(), getBuySellEventDecoder());
}
