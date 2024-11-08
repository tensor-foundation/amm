/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  combineCodec,
  getAddressDecoder,
  getAddressEncoder,
  getDiscriminatedUnionDecoder,
  getDiscriminatedUnionEncoder,
  getStructDecoder,
  getStructEncoder,
  getTupleDecoder,
  getTupleEncoder,
  getU64Decoder,
  getU64Encoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type GetDiscriminatedUnionVariant,
  type GetDiscriminatedUnionVariantContent,
} from '@solana/web3.js';
import {
  getProofInfoLocalDecoder,
  getProofInfoLocalEncoder,
  getSeedsVecLocalDecoder,
  getSeedsVecLocalEncoder,
  type ProofInfoLocal,
  type ProofInfoLocalArgs,
  type SeedsVecLocal,
  type SeedsVecLocalArgs,
} from '.';

/** Local version of `PayloadType` for IDL export. */
export type PayloadTypeLocal =
  | { __kind: 'Pubkey'; fields: readonly [Address] }
  | { __kind: 'Seeds'; fields: readonly [SeedsVecLocal] }
  | { __kind: 'MerkleProof'; fields: readonly [ProofInfoLocal] }
  | { __kind: 'Number'; fields: readonly [bigint] };

export type PayloadTypeLocalArgs =
  | { __kind: 'Pubkey'; fields: readonly [Address] }
  | { __kind: 'Seeds'; fields: readonly [SeedsVecLocalArgs] }
  | { __kind: 'MerkleProof'; fields: readonly [ProofInfoLocalArgs] }
  | { __kind: 'Number'; fields: readonly [number | bigint] };

export function getPayloadTypeLocalEncoder(): Encoder<PayloadTypeLocalArgs> {
  return getDiscriminatedUnionEncoder([
    [
      'Pubkey',
      getStructEncoder([['fields', getTupleEncoder([getAddressEncoder()])]]),
    ],
    [
      'Seeds',
      getStructEncoder([
        ['fields', getTupleEncoder([getSeedsVecLocalEncoder()])],
      ]),
    ],
    [
      'MerkleProof',
      getStructEncoder([
        ['fields', getTupleEncoder([getProofInfoLocalEncoder()])],
      ]),
    ],
    [
      'Number',
      getStructEncoder([['fields', getTupleEncoder([getU64Encoder()])]]),
    ],
  ]);
}

export function getPayloadTypeLocalDecoder(): Decoder<PayloadTypeLocal> {
  return getDiscriminatedUnionDecoder([
    [
      'Pubkey',
      getStructDecoder([['fields', getTupleDecoder([getAddressDecoder()])]]),
    ],
    [
      'Seeds',
      getStructDecoder([
        ['fields', getTupleDecoder([getSeedsVecLocalDecoder()])],
      ]),
    ],
    [
      'MerkleProof',
      getStructDecoder([
        ['fields', getTupleDecoder([getProofInfoLocalDecoder()])],
      ]),
    ],
    [
      'Number',
      getStructDecoder([['fields', getTupleDecoder([getU64Decoder()])]]),
    ],
  ]);
}

export function getPayloadTypeLocalCodec(): Codec<
  PayloadTypeLocalArgs,
  PayloadTypeLocal
> {
  return combineCodec(
    getPayloadTypeLocalEncoder(),
    getPayloadTypeLocalDecoder()
  );
}

// Data Enum Helpers.
export function payloadTypeLocal(
  kind: 'Pubkey',
  data: GetDiscriminatedUnionVariantContent<
    PayloadTypeLocalArgs,
    '__kind',
    'Pubkey'
  >['fields']
): GetDiscriminatedUnionVariant<PayloadTypeLocalArgs, '__kind', 'Pubkey'>;
export function payloadTypeLocal(
  kind: 'Seeds',
  data: GetDiscriminatedUnionVariantContent<
    PayloadTypeLocalArgs,
    '__kind',
    'Seeds'
  >['fields']
): GetDiscriminatedUnionVariant<PayloadTypeLocalArgs, '__kind', 'Seeds'>;
export function payloadTypeLocal(
  kind: 'MerkleProof',
  data: GetDiscriminatedUnionVariantContent<
    PayloadTypeLocalArgs,
    '__kind',
    'MerkleProof'
  >['fields']
): GetDiscriminatedUnionVariant<PayloadTypeLocalArgs, '__kind', 'MerkleProof'>;
export function payloadTypeLocal(
  kind: 'Number',
  data: GetDiscriminatedUnionVariantContent<
    PayloadTypeLocalArgs,
    '__kind',
    'Number'
  >['fields']
): GetDiscriminatedUnionVariant<PayloadTypeLocalArgs, '__kind', 'Number'>;
export function payloadTypeLocal<
  K extends PayloadTypeLocalArgs['__kind'],
  Data,
>(kind: K, data?: Data) {
  return Array.isArray(data)
    ? { __kind: kind, fields: data }
    : { __kind: kind, ...(data ?? {}) };
}

export function isPayloadTypeLocal<K extends PayloadTypeLocal['__kind']>(
  kind: K,
  value: PayloadTypeLocal
): value is PayloadTypeLocal & { __kind: K } {
  return value.__kind === kind;
}
