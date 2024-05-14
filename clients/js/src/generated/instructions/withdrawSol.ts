/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Address } from '@solana/addresses';
import {
  Codec,
  Decoder,
  Encoder,
  combineCodec,
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  mapEncoder,
} from '@solana/codecs';
import {
  IAccountMeta,
  IInstruction,
  IInstructionWithAccounts,
  IInstructionWithData,
  ReadonlyAccount,
  WritableAccount,
  WritableSignerAccount,
} from '@solana/instructions';
import { IAccountSignerMeta, TransactionSigner } from '@solana/signers';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import { ResolvedAccount, getAccountMetaFactory } from '../shared';

export type WithdrawSolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
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
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type WithdrawSolInstructionData = {
  discriminator: Array<number>;
  lamports: bigint;
};

export type WithdrawSolInstructionDataArgs = { lamports: number | bigint };

export function getWithdrawSolInstructionDataEncoder(): Encoder<WithdrawSolInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['lamports', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: [145, 131, 74, 136, 65, 137, 42, 38],
    })
  );
}

export function getWithdrawSolInstructionDataDecoder(): Decoder<WithdrawSolInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['lamports', getU64Decoder()],
  ]);
}

export function getWithdrawSolInstructionDataCodec(): Codec<
  WithdrawSolInstructionDataArgs,
  WithdrawSolInstructionData
> {
  return combineCodec(
    getWithdrawSolInstructionDataEncoder(),
    getWithdrawSolInstructionDataDecoder()
  );
}

export type WithdrawSolInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and will receive the SOL. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool from which the SOL will be withdrawn. */
  pool: Address<TAccountPool>;
  systemProgram?: Address<TAccountSystemProgram>;
  lamports: WithdrawSolInstructionDataArgs['lamports'];
};

export function getWithdrawSolInstruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountSystemProgram extends string,
>(
  input: WithdrawSolInput<TAccountOwner, TAccountPool, TAccountSystemProgram>
): WithdrawSolInstruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountPool,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawSolInstructionDataEncoder().encode(
      args as WithdrawSolInstructionDataArgs
    ),
  } as WithdrawSolInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedWithdrawSolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The owner of the pool and will receive the SOL. */
    owner: TAccountMetas[0];
    /** The pool from which the SOL will be withdrawn. */
    pool: TAccountMetas[1];
    systemProgram: TAccountMetas[2];
  };
  data: WithdrawSolInstructionData;
};

export function parseWithdrawSolInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedWithdrawSolInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 3) {
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
      systemProgram: getNextAccount(),
    },
    data: getWithdrawSolInstructionDataDecoder().decode(instruction.data),
  };
}
