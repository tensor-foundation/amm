/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/kinobi-so/kinobi
 */

import {
  fixEncoderSize,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
  type ProgramDerivedAddress,
  type ReadonlyUint8Array,
} from '@solana/web3.js';

export type PoolSeeds = {
  /** The address of the pool owner */
  owner: Address;
  /** Pool unique ID */
  poolId: ReadonlyUint8Array;
};

export async function findPoolPda(
  seeds: PoolSeeds,
  config: { programAddress?: Address | undefined } = {}
): Promise<ProgramDerivedAddress> {
  const {
    programAddress = 'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>,
  } = config;
  return await getProgramDerivedAddress({
    programAddress,
    seeds: [
      getUtf8Encoder().encode('pool'),
      getAddressEncoder().encode(seeds.owner),
      fixEncoderSize(getBytesEncoder(), 32).encode(seeds.poolId),
    ],
  });
}
