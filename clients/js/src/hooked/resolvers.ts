import { address, ProgramDerivedAddress } from '@solana/web3.js';
import {
  findAssociatedTokenAccountPda,
  findFeeVaultPda,
  findNftReceiptPda,
} from '@tensor-foundation/resolvers';
import { ResolvedAccount, expectAddress } from '../generated/shared';
import {
  findTokenRecordPda,
  TokenStandard,
} from '@tensor-foundation/mpl-token-metadata';

// Satisfy linter
type ArgsAny = {
  [key: string]: unknown;
};

export const resolveTakerAta = async ({
  accounts,
}: {
  accounts: Record<string, ResolvedAccount>;
}): Promise<Partial<{ value: ProgramDerivedAddress | null }>> => {
  return {
    value: await findAssociatedTokenAccountPda({
      owner: expectAddress(accounts.taker?.value),
      mint: expectAddress(accounts.mint?.value),
      tokenProgram: expectAddress(accounts.tokenProgram?.value),
    }),
  };
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

export const resolveTakerTokenRecordFromTokenStandard = async ({
  accounts,
  args,
}: {
  accounts: Record<string, ResolvedAccount>;
  args: { tokenStandard?: TokenStandard | undefined };
}): Promise<Partial<{ value: ProgramDerivedAddress | null }>> => {
  return args.tokenStandard === TokenStandard.ProgrammableNonFungible ||
    args.tokenStandard === TokenStandard.ProgrammableNonFungibleEdition
    ? {
        value: await findTokenRecordPda({
          mint: expectAddress(accounts.mint?.value),
          token: expectAddress(accounts.takerTa?.value),
        }),
      }
    : { value: null };
};

export const resolveUserTokenRecordFromTokenStandard = async ({
  accounts,
  args,
}: {
  accounts: Record<string, ResolvedAccount>;
  args: { tokenStandard?: TokenStandard | undefined };
}): Promise<Partial<{ value: ProgramDerivedAddress | null }>> => {
  return args.tokenStandard === TokenStandard.ProgrammableNonFungible ||
    args.tokenStandard === TokenStandard.ProgrammableNonFungibleEdition
    ? {
        value: await findTokenRecordPda({
          mint: expectAddress(accounts.mint?.value),
          token: expectAddress(
            accounts.takerTa?.value ?? accounts.ownerTa?.value
          ),
        }),
      }
    : { value: null };
};
