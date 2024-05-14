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
} from '@solana/instructions';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import { ResolvedAccount, getAccountMetaFactory } from '../shared';
import {
  TAmmEvent,
  TAmmEventArgs,
  getTAmmEventDecoder,
  getTAmmEventEncoder,
} from '../types';

export type TammNoopInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountPool extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountPool extends string
        ? ReadonlyAccount<TAccountPool>
        : TAccountPool,
      ...TRemainingAccounts,
    ]
  >;

export type TammNoopInstructionData = {
  discriminator: Array<number>;
  event: TAmmEvent;
};

export type TammNoopInstructionDataArgs = { event: TAmmEventArgs };

export function getTammNoopInstructionDataEncoder(): Encoder<TammNoopInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['event', getTAmmEventEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: [31, 162, 228, 158, 153, 160, 198, 182],
    })
  );
}

export function getTammNoopInstructionDataDecoder(): Decoder<TammNoopInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['event', getTAmmEventDecoder()],
  ]);
}

export function getTammNoopInstructionDataCodec(): Codec<
  TammNoopInstructionDataArgs,
  TammNoopInstructionData
> {
  return combineCodec(
    getTammNoopInstructionDataEncoder(),
    getTammNoopInstructionDataDecoder()
  );
}

export type TammNoopInput<TAccountPool extends string = string> = {
  pool: Address<TAccountPool>;
  event: TammNoopInstructionDataArgs['event'];
};

export function getTammNoopInstruction<TAccountPool extends string>(
  input: TammNoopInput<TAccountPool>
): TammNoopInstruction<typeof TENSOR_AMM_PROGRAM_ADDRESS, TAccountPool> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    pool: { value: input.pool ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [getAccountMeta(accounts.pool)],
    programAddress,
    data: getTammNoopInstructionDataEncoder().encode(
      args as TammNoopInstructionDataArgs
    ),
  } as TammNoopInstruction<typeof TENSOR_AMM_PROGRAM_ADDRESS, TAccountPool>;

  return instruction;
}

export type ParsedTammNoopInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    pool: TAccountMetas[0];
  };
  data: TammNoopInstructionData;
};

export function parseTammNoopInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedTammNoopInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 1) {
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
      pool: getNextAccount(),
    },
    data: getTammNoopInstructionDataDecoder().decode(instruction.data),
  };
}
