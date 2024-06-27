import {
  Address,
  address,
  getAddressDecoder,
  getAddressEncoder,
  combineCodec,
} from '@solana/web3.js';

const SOL_ADDRESS = address('11111111111111111111111111111111');

export type Currency = Address;
export type CurrencyArgs = Currency;

export const isSol = (currency: Currency) => currency === SOL_ADDRESS;
export const solCurrency = () => SOL_ADDRESS;

export const getCurrencyEncoder = () => getAddressEncoder();
export const getCurrencyDecoder = () => getAddressDecoder();

export const getCurrencyCodec = () =>
  combineCodec(getCurrencyEncoder(), getCurrencyDecoder());
