/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/kinobi-so/kinobi
 */

import {
  addDecoderSizePrefix,
  addEncoderSizePrefix,
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getUtf8Decoder,
  getUtf8Encoder,
  type Codec,
  type Decoder,
  type Encoder,
} from '@solana/web3.js';
import {
  getPayloadTypeLocalDecoder,
  getPayloadTypeLocalEncoder,
  type PayloadTypeLocal,
  type PayloadTypeLocalArgs,
} from '.';

/** Local version of `TaggedPayload` for IDL export. */
export type TaggedPayload = { name: string; payload: PayloadTypeLocal };

export type TaggedPayloadArgs = { name: string; payload: PayloadTypeLocalArgs };

export function getTaggedPayloadEncoder(): Encoder<TaggedPayloadArgs> {
  return getStructEncoder([
    ['name', addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
    ['payload', getPayloadTypeLocalEncoder()],
  ]);
}

export function getTaggedPayloadDecoder(): Decoder<TaggedPayload> {
  return getStructDecoder([
    ['name', addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ['payload', getPayloadTypeLocalDecoder()],
  ]);
}

export function getTaggedPayloadCodec(): Codec<
  TaggedPayloadArgs,
  TaggedPayload
> {
  return combineCodec(getTaggedPayloadEncoder(), getTaggedPayloadDecoder());
}
