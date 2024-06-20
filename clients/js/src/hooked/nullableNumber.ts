import {
  combineCodec,
  createDecoder,
  createEncoder,
  getU16Decoder,
  getU16Encoder,
} from '@solana/web3.js';

export type NullableU16 = number | null;
export type NullableU16Args = NullableU16;

export const getNullableU16Encoder = () =>
  createEncoder<NullableU16>({
    fixedSize: 2,
    write(value, bytes, offset) {
      if (value === null) {
        bytes.set(getU16Encoder().encode(0), offset);
      } else {
        bytes.set(getU16Encoder().encode(value), offset);
      }
      return offset + 2;
    },
  });

export const getNullableU16Decoder = () =>
  createDecoder<NullableU16>({
    fixedSize: 2,
    read(bytes, offset) {
      if (getU16Decoder().decode(bytes, offset) === 0) {
        return [null, offset + 2];
      } else {
        return [getU16Decoder().decode(bytes, offset), offset + 2];
      }
    },
  });

export const getNullableU16Codec = () =>
  combineCodec(getNullableU16Encoder(), getNullableU16Decoder());
