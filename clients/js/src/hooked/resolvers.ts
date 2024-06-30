import { ProgramDerivedAddress } from '@solana/web3.js';
import { findFeeVaultPda } from '@tensor-foundation/resolvers';
import { ResolvedAccount, expectAddress } from '../generated/shared';

// Satisfy linter
type ArgsAny = {
  [key: string]: unknown;
};

export const resolvePoolIdOnCreate = (_: ArgsAny) => {
  return new Uint8Array(32).map(() => (Math.random() * 256) & 255);
};

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
