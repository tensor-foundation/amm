import { ProgramDerivedAddress } from '@solana/web3.js';
import { findFeeVaultPda } from '@tensor-foundation/resolvers';
import { ResolvedAccount, expectAddress } from '../generated/shared';

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
