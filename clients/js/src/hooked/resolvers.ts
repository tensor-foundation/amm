import {
  Address,
  ProgramDerivedAddress,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/addresses';
// import { findFeeVaultPda } from '@tensor-foundation/resolvers';
import { ResolvedAccount, expectAddress } from '../generated';
import { getStringEncoder, getU8Encoder } from '@solana/codecs';

export const resolveFeeVaultPdaFromPool = async ({
  accounts,
}: {
  accounts: Record<string, ResolvedAccount>;
}): Promise<Partial<{ value: ProgramDerivedAddress | null }>> => {
  return {
    value: await findFeeVaultPda({
      address: expectAddress(accounts.pool?.value),
    }),
  };
};

type FeeVaultSeeds = {
  /** The address of the state account to derive the shard from: e.g. pool, bid, order etc. */
  address: Address;
};

async function findFeeVaultPda(
  seeds: FeeVaultSeeds
): Promise<ProgramDerivedAddress> {
  // Last byte of state account address is the fee vault shard number.
  const bytes = getAddressEncoder().encode(seeds.address);
  const lastByte = bytes[bytes.length - 1];

  return await getProgramDerivedAddress({
    programAddress: address('TFEEgwDP6nn1s8mMX2tTNPPz8j2VomkphLUmyxKm17A'),
    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),
      getU8Encoder().encode(lastByte),
    ],
  });
}
