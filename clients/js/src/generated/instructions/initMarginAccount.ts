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
  mapEncoder,
} from '@solana/codecs-core';
import {
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
} from '@solana/codecs-data-structures';
import {
  getU16Decoder,
  getU16Encoder,
  getU8Decoder,
  getU8Encoder,
} from '@solana/codecs-numbers';
import {
  AccountRole,
  IAccountMeta,
  IInstruction,
  IInstructionWithAccounts,
  IInstructionWithData,
  ReadonlyAccount,
  WritableAccount,
  WritableSignerAccount,
} from '@solana/instructions';
import { IAccountSignerMeta, TransactionSigner } from '@solana/signers';
import {
  ResolvedAccount,
  accountMetaWithDefault,
  getAccountMetasWithSigners,
} from '../shared';

export type InitMarginAccountInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSharedEscrow extends string
        ? WritableAccount<TAccountSharedEscrow>
        : TAccountSharedEscrow,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner>
        : TAccountOwner,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts
    ]
  >;

export type InitMarginAccountInstructionWithSigners<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSharedEscrow extends string
        ? WritableAccount<TAccountSharedEscrow>
        : TAccountSharedEscrow,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner> &
            IAccountSignerMeta<TAccountOwner>
        : TAccountOwner,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts
    ]
  >;

export type InitMarginAccountInstructionData = {
  discriminator: Array<number>;
  marginNr: number;
  name: Uint8Array;
};

export type InitMarginAccountInstructionDataArgs = {
  marginNr: number;
  name: Uint8Array;
};

export function getInitMarginAccountInstructionDataEncoder(): Encoder<InitMarginAccountInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['marginNr', getU16Encoder()],
      ['name', getBytesEncoder({ size: 32 })],
    ]),
    (value) => ({ ...value, discriminator: [10, 54, 68, 252, 130, 97, 39, 52] })
  );
}

export function getInitMarginAccountInstructionDataDecoder(): Decoder<InitMarginAccountInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['marginNr', getU16Decoder()],
    ['name', getBytesDecoder({ size: 32 })],
  ]);
}

export function getInitMarginAccountInstructionDataCodec(): Codec<
  InitMarginAccountInstructionDataArgs,
  InitMarginAccountInstructionData
> {
  return combineCodec(
    getInitMarginAccountInstructionDataEncoder(),
    getInitMarginAccountInstructionDataDecoder()
  );
}

export type InitMarginAccountInput<
  TAccountSharedEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  sharedEscrow: Address<TAccountSharedEscrow>;
  owner: Address<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  marginNr: InitMarginAccountInstructionDataArgs['marginNr'];
  name: InitMarginAccountInstructionDataArgs['name'];
};

export type InitMarginAccountInputWithSigners<
  TAccountSharedEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  sharedEscrow: Address<TAccountSharedEscrow>;
  owner: TransactionSigner<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  marginNr: InitMarginAccountInstructionDataArgs['marginNr'];
  name: InitMarginAccountInstructionDataArgs['name'];
};

export function getInitMarginAccountInstruction<
  TAccountSharedEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: InitMarginAccountInputWithSigners<
    TAccountSharedEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): InitMarginAccountInstructionWithSigners<
  TProgram,
  TAccountSharedEscrow,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getInitMarginAccountInstruction<
  TAccountSharedEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: InitMarginAccountInput<
    TAccountSharedEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): InitMarginAccountInstruction<
  TProgram,
  TAccountSharedEscrow,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getInitMarginAccountInstruction<
  TAccountSharedEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: InitMarginAccountInput<
    TAccountSharedEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): IInstruction {
  // Program address.
  const programAddress =
    'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

  // Original accounts.
  type AccountMetas = Parameters<
    typeof getInitMarginAccountInstructionRaw<
      TProgram,
      TAccountSharedEscrow,
      TAccountOwner,
      TAccountSystemProgram
    >
  >[0];
  const accounts: Record<keyof AccountMetas, ResolvedAccount> = {
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    owner: { value: input.owner ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  // Get account metas and signers.
  const accountMetas = getAccountMetasWithSigners(
    accounts,
    'programId',
    programAddress
  );

  const instruction = getInitMarginAccountInstructionRaw(
    accountMetas as Record<keyof AccountMetas, IAccountMeta>,
    args as InitMarginAccountInstructionDataArgs,
    programAddress
  );

  return instruction;
}

export function getInitMarginAccountInstructionRaw<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
>(
  accounts: {
    sharedEscrow: TAccountSharedEscrow extends string
      ? Address<TAccountSharedEscrow>
      : TAccountSharedEscrow;
    owner: TAccountOwner extends string
      ? Address<TAccountOwner>
      : TAccountOwner;
    systemProgram?: TAccountSystemProgram extends string
      ? Address<TAccountSystemProgram>
      : TAccountSystemProgram;
  },
  args: InitMarginAccountInstructionDataArgs,
  programAddress: Address<TProgram> = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<TProgram>,
  remainingAccounts?: TRemainingAccounts
) {
  return {
    accounts: [
      accountMetaWithDefault(accounts.sharedEscrow, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.owner, AccountRole.WRITABLE_SIGNER),
      accountMetaWithDefault(
        accounts.systemProgram ??
          ('11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>),
        AccountRole.READONLY
      ),
      ...(remainingAccounts ?? []),
    ],
    data: getInitMarginAccountInstructionDataEncoder().encode(args),
    programAddress,
  } as InitMarginAccountInstruction<
    TProgram,
    TAccountSharedEscrow,
    TAccountOwner,
    TAccountSystemProgram,
    TRemainingAccounts
  >;
}

export type ParsedInitMarginAccountInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[]
> = {
  programAddress: Address<TProgram>;
  accounts: {
    sharedEscrow: TAccountMetas[0];
    owner: TAccountMetas[1];
    systemProgram: TAccountMetas[2];
  };
  data: InitMarginAccountInstructionData;
};

export function parseInitMarginAccountInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[]
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedInitMarginAccountInstruction<TProgram, TAccountMetas> {
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
      sharedEscrow: getNextAccount(),
      owner: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getInitMarginAccountInstructionDataDecoder().decode(instruction.data),
  };
}
