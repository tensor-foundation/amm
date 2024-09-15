import { address, ProgramDerivedAddress } from '@solana/web3.js';
import {
  findFeeVaultPda,
  findNftReceiptPda,
} from '@tensor-foundation/resolvers';
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

export const resolvePoolAssetReceipt = async ({
  accounts,
}: {
  accounts: Record<string, ResolvedAccount>;
}): Promise<Partial<{ value: ProgramDerivedAddress | null }>> => {
  return {
    value: await findNftReceiptPda(
      {
        mint: expectAddress(accounts.asset?.value),
        state: expectAddress(accounts.pool?.value),
      },
      { programAddress: address('TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg') }
    ),
  };
};
