/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/kinobi-so/kinobi
 */

import {
  combineCodec,
  getEnumDecoder,
  getEnumEncoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/web3.js';

export enum TransferDirection {
  IntoPool,
  OutOfPool,
}

export type TransferDirectionArgs = TransferDirection;

export function getTransferDirectionEncoder(): Encoder<TransferDirectionArgs> {
  return getEnumEncoder(TransferDirection);
}

export function getTransferDirectionDecoder(): Decoder<TransferDirection> {
  return getEnumDecoder(TransferDirection);
}

export function getTransferDirectionCodec(): Codec<
  TransferDirectionArgs,
  TransferDirection
> {
  return combineCodec(
    getTransferDirectionEncoder(),
    getTransferDirectionDecoder()
  );
}
