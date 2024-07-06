/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/kinobi-so/kinobi
 */

import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  transformEncoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type IAccountMeta,
  type IAccountSignerMeta,
  type IInstruction,
  type IInstructionWithAccounts,
  type IInstructionWithData,
  type ReadonlyAccount,
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import {
  resolveOwnerAta,
  resolvePoolAta,
  resolvePoolNftReceipt,
} from '@tensor-foundation/resolvers';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export type WithdrawNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountOwnerTa extends string | IAccountMeta<string> = string,
  TAccountPoolTa extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends
    | string
    | IAccountMeta<string> = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner> &
            IAccountSignerMeta<TAccountOwner>
        : TAccountOwner,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountOwnerTa extends string
        ? WritableAccount<TAccountOwnerTa>
        : TAccountOwnerTa,
      TAccountPoolTa extends string
        ? WritableAccount<TAccountPoolTa>
        : TAccountPoolTa,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type WithdrawNftT22InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type WithdrawNftT22InstructionDataArgs = {};

export function getWithdrawNftT22InstructionDataEncoder(): Encoder<WithdrawNftT22InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([['discriminator', fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([112, 55, 80, 231, 181, 190, 92, 12]),
    })
  );
}

export function getWithdrawNftT22InstructionDataDecoder(): Decoder<WithdrawNftT22InstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getWithdrawNftT22InstructionDataCodec(): Codec<
  WithdrawNftT22InstructionDataArgs,
  WithdrawNftT22InstructionData
> {
  return combineCodec(
    getWithdrawNftT22InstructionDataEncoder(),
    getWithdrawNftT22InstructionDataDecoder()
  );
}

export type WithdrawNftT22AsyncInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool--must sign to withdraw an NFT from the pool. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool holding the NFT. */
  pool: Address<TAccountPool>;
  /** The mint of the NFT. */
  mint: Address<TAccountMint>;
  /** The TA of the owner where the NFT will be withdrawn to. */
  ownerTa?: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT token is escrowed. */
  poolTa?: Address<TAccountPoolTa>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export async function getWithdrawNftT22InstructionAsync<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: WithdrawNftT22AsyncInput<
    TAccountOwner,
    TAccountPool,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): Promise<
  WithdrawNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolver scope.
  const resolverScope = { programAddress, accounts };

  // Resolve default values.
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.ownerTa.value) {
    accounts.ownerTa = {
      ...accounts.ownerTa,
      ...(await resolveOwnerAta(resolverScope)),
    };
  }
  if (!accounts.poolTa.value) {
    accounts.poolTa = {
      ...accounts.poolTa,
      ...(await resolvePoolAta(resolverScope)),
    };
  }
  if (!accounts.nftReceipt.value) {
    accounts.nftReceipt = {
      ...accounts.nftReceipt,
      ...(await resolvePoolNftReceipt(resolverScope)),
    };
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftT22InstructionDataEncoder().encode({}),
  } as WithdrawNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type WithdrawNftT22Input<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool--must sign to withdraw an NFT from the pool. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool holding the NFT. */
  pool: Address<TAccountPool>;
  /** The mint of the NFT. */
  mint: Address<TAccountMint>;
  /** The TA of the owner where the NFT will be withdrawn to. */
  ownerTa: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT token is escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export function getWithdrawNftT22Instruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: WithdrawNftT22Input<
    TAccountOwner,
    TAccountPool,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): WithdrawNftT22Instruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountPool,
  TAccountMint,
  TAccountOwnerTa,
  TAccountPoolTa,
  TAccountNftReceipt,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolve default values.
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftT22InstructionDataEncoder().encode({}),
  } as WithdrawNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedWithdrawNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The owner of the pool--must sign to withdraw an NFT from the pool. */
    owner: TAccountMetas[0];
    /** The pool holding the NFT. */
    pool: TAccountMetas[1];
    /** The mint of the NFT. */
    mint: TAccountMetas[2];
    /** The TA of the owner where the NFT will be withdrawn to. */
    ownerTa: TAccountMetas[3];
    /** The TA of the pool, where the NFT token is escrowed. */
    poolTa: TAccountMetas[4];
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[5];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[6];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[7];
    /** The Solana system program. */
    systemProgram: TAccountMetas[8];
  };
  data: WithdrawNftT22InstructionData;
};

export function parseWithdrawNftT22Instruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedWithdrawNftT22Instruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 9) {
    // TODO: Coded error.
    throw new Error('Not enough accounts');
  }
  let accountIndex = 0;
  const getNextAccount = () => {
    const accountMeta = instruction.accounts![accountIndex]!;
    accountIndex += 1;
    return accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      owner: getNextAccount(),
      pool: getNextAccount(),
      mint: getNextAccount(),
      ownerTa: getNextAccount(),
      poolTa: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getWithdrawNftT22InstructionDataDecoder().decode(instruction.data),
  };
}
