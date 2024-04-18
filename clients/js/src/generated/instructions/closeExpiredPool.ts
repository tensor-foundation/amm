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
  WritableAccount,
} from '@solana/instructions';
import { AMM_PROGRAM_ADDRESS } from '../programs';
import { ResolvedAccount, getAccountMetaFactory } from '../shared';

export type CloseExpiredPoolInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountRentPayer extends string | IAccountMeta<string> = string,
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
      TAccountRentPayer extends string
        ? ReadonlyAccount<TAccountRentPayer>
        : TAccountRentPayer,
      TAccountOwner extends string
        ? WritableAccount<TAccountOwner>
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

export type CloseExpiredPoolInstructionData = { discriminator: Array<number> };

export type CloseExpiredPoolInstructionDataArgs = {};

export function getCloseExpiredPoolInstructionDataEncoder(): Encoder<CloseExpiredPoolInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
    ]),
    (value) => ({
      ...value,
      discriminator: [108, 212, 233, 53, 132, 83, 63, 219],
    })
  );
}

export function getCloseExpiredPoolInstructionDataDecoder(): Decoder<CloseExpiredPoolInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
  ]);
}

export function getCloseExpiredPoolInstructionDataCodec(): Codec<
  CloseExpiredPoolInstructionDataArgs,
  CloseExpiredPoolInstructionData
> {
  return combineCodec(
    getCloseExpiredPoolInstructionDataEncoder(),
    getCloseExpiredPoolInstructionDataDecoder()
  );
}

export type CloseExpiredPoolInput<
  TAccountRentPayer extends string = string,
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  rentPayer: Address<TAccountRentPayer>;
  owner: Address<TAccountOwner>;
  pool: Address<TAccountPool>;
  systemProgram?: Address<TAccountSystemProgram>;
};

export function getCloseExpiredPoolInstruction<
  TAccountRentPayer extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountSystemProgram extends string,
>(
  input: CloseExpiredPoolInput<
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountSystemProgram
  >
): CloseExpiredPoolInstruction<
  typeof AMM_PROGRAM_ADDRESS,
  TAccountRentPayer,
  TAccountOwner,
  TAccountPool,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    rentPayer: { value: input.rentPayer ?? null, isWritable: false },
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolve default values.
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.rentPayer),
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getCloseExpiredPoolInstructionDataEncoder().encode({}),
  } as CloseExpiredPoolInstruction<
    typeof AMM_PROGRAM_ADDRESS,
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedCloseExpiredPoolInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    rentPayer: TAccountMetas[0];
    owner: TAccountMetas[1];
    pool: TAccountMetas[2];
    systemProgram: TAccountMetas[3];
  };
  data: CloseExpiredPoolInstructionData;
};

export function parseCloseExpiredPoolInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedCloseExpiredPoolInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 4) {
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
      rentPayer: getNextAccount(),
      owner: getNextAccount(),
      pool: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getCloseExpiredPoolInstructionDataDecoder().decode(instruction.data),
  };
}
