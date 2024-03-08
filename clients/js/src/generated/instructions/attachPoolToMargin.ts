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
  getStructDecoder,
  getStructEncoder,
} from '@solana/codecs-data-structures';
import { getU8Decoder, getU8Encoder } from '@solana/codecs-numbers';
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
import {
  PoolConfig,
  PoolConfigArgs,
  getPoolConfigDecoder,
  getPoolConfigEncoder,
} from '../types';

export type AttachPoolToMarginInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountSolEscrow extends string | IAccountMeta<string> = string,
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
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountWhitelist extends string
        ? ReadonlyAccount<TAccountWhitelist>
        : TAccountWhitelist,
      TAccountSolEscrow extends string
        ? WritableAccount<TAccountSolEscrow>
        : TAccountSolEscrow,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner>
        : TAccountOwner,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts
    ]
  >;

export type AttachPoolToMarginInstructionWithSigners<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountSolEscrow extends string | IAccountMeta<string> = string,
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
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountWhitelist extends string
        ? ReadonlyAccount<TAccountWhitelist>
        : TAccountWhitelist,
      TAccountSolEscrow extends string
        ? WritableAccount<TAccountSolEscrow>
        : TAccountSolEscrow,
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

export type AttachPoolToMarginInstructionData = {
  discriminator: Array<number>;
  config: PoolConfig;
};

export type AttachPoolToMarginInstructionDataArgs = { config: PoolConfigArgs };

export function getAttachPoolToMarginInstructionDataEncoder() {
  return mapEncoder(
    getStructEncoder<{ discriminator: Array<number>; config: PoolConfigArgs }>([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['config', getPoolConfigEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: [187, 105, 211, 137, 224, 59, 29, 227],
    })
  ) satisfies Encoder<AttachPoolToMarginInstructionDataArgs>;
}

export function getAttachPoolToMarginInstructionDataDecoder() {
  return getStructDecoder<AttachPoolToMarginInstructionData>([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['config', getPoolConfigDecoder()],
  ]) satisfies Decoder<AttachPoolToMarginInstructionData>;
}

export function getAttachPoolToMarginInstructionDataCodec(): Codec<
  AttachPoolToMarginInstructionDataArgs,
  AttachPoolToMarginInstructionData
> {
  return combineCodec(
    getAttachPoolToMarginInstructionDataEncoder(),
    getAttachPoolToMarginInstructionDataDecoder()
  );
}

export type AttachPoolToMarginInput<
  TAccountSharedEscrow extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSolEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  sharedEscrow: Address<TAccountSharedEscrow>;
  pool: Address<TAccountPool>;
  /** Needed for pool seeds derivation / will be stored inside pool */
  whitelist: Address<TAccountWhitelist>;
  solEscrow: Address<TAccountSolEscrow>;
  owner: Address<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  config: AttachPoolToMarginInstructionDataArgs['config'];
};

export type AttachPoolToMarginInputWithSigners<
  TAccountSharedEscrow extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSolEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  sharedEscrow: Address<TAccountSharedEscrow>;
  pool: Address<TAccountPool>;
  /** Needed for pool seeds derivation / will be stored inside pool */
  whitelist: Address<TAccountWhitelist>;
  solEscrow: Address<TAccountSolEscrow>;
  owner: TransactionSigner<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  config: AttachPoolToMarginInstructionDataArgs['config'];
};

export function getAttachPoolToMarginInstruction<
  TAccountSharedEscrow extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSolEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: AttachPoolToMarginInputWithSigners<
    TAccountSharedEscrow,
    TAccountPool,
    TAccountWhitelist,
    TAccountSolEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): AttachPoolToMarginInstructionWithSigners<
  TProgram,
  TAccountSharedEscrow,
  TAccountPool,
  TAccountWhitelist,
  TAccountSolEscrow,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getAttachPoolToMarginInstruction<
  TAccountSharedEscrow extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSolEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: AttachPoolToMarginInput<
    TAccountSharedEscrow,
    TAccountPool,
    TAccountWhitelist,
    TAccountSolEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): AttachPoolToMarginInstruction<
  TProgram,
  TAccountSharedEscrow,
  TAccountPool,
  TAccountWhitelist,
  TAccountSolEscrow,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getAttachPoolToMarginInstruction<
  TAccountSharedEscrow extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSolEscrow extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: AttachPoolToMarginInput<
    TAccountSharedEscrow,
    TAccountPool,
    TAccountWhitelist,
    TAccountSolEscrow,
    TAccountOwner,
    TAccountSystemProgram
  >
): IInstruction {
  // Program address.
  const programAddress =
    'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

  // Original accounts.
  type AccountMetas = Parameters<
    typeof getAttachPoolToMarginInstructionRaw<
      TProgram,
      TAccountSharedEscrow,
      TAccountPool,
      TAccountWhitelist,
      TAccountSolEscrow,
      TAccountOwner,
      TAccountSystemProgram
    >
  >[0];
  const accounts: Record<keyof AccountMetas, ResolvedAccount> = {
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    solEscrow: { value: input.solEscrow ?? null, isWritable: true },
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

  const instruction = getAttachPoolToMarginInstructionRaw(
    accountMetas as Record<keyof AccountMetas, IAccountMeta>,
    args as AttachPoolToMarginInstructionDataArgs,
    programAddress
  );

  return instruction;
}

export function getAttachPoolToMarginInstructionRaw<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountSolEscrow extends string | IAccountMeta<string> = string,
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
    pool: TAccountPool extends string ? Address<TAccountPool> : TAccountPool;
    whitelist: TAccountWhitelist extends string
      ? Address<TAccountWhitelist>
      : TAccountWhitelist;
    solEscrow: TAccountSolEscrow extends string
      ? Address<TAccountSolEscrow>
      : TAccountSolEscrow;
    owner: TAccountOwner extends string
      ? Address<TAccountOwner>
      : TAccountOwner;
    systemProgram?: TAccountSystemProgram extends string
      ? Address<TAccountSystemProgram>
      : TAccountSystemProgram;
  },
  args: AttachPoolToMarginInstructionDataArgs,
  programAddress: Address<TProgram> = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<TProgram>,
  remainingAccounts?: TRemainingAccounts
) {
  return {
    accounts: [
      accountMetaWithDefault(accounts.sharedEscrow, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.pool, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.whitelist, AccountRole.READONLY),
      accountMetaWithDefault(accounts.solEscrow, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.owner, AccountRole.WRITABLE_SIGNER),
      accountMetaWithDefault(
        accounts.systemProgram ??
          ('11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>),
        AccountRole.READONLY
      ),
      ...(remainingAccounts ?? []),
    ],
    data: getAttachPoolToMarginInstructionDataEncoder().encode(args),
    programAddress,
  } as AttachPoolToMarginInstruction<
    TProgram,
    TAccountSharedEscrow,
    TAccountPool,
    TAccountWhitelist,
    TAccountSolEscrow,
    TAccountOwner,
    TAccountSystemProgram,
    TRemainingAccounts
  >;
}

export type ParsedAttachPoolToMarginInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[]
> = {
  programAddress: Address<TProgram>;
  accounts: {
    sharedEscrow: TAccountMetas[0];
    pool: TAccountMetas[1];
    /** Needed for pool seeds derivation / will be stored inside pool */
    whitelist: TAccountMetas[2];
    solEscrow: TAccountMetas[3];
    owner: TAccountMetas[4];
    systemProgram: TAccountMetas[5];
  };
  data: AttachPoolToMarginInstructionData;
};

export function parseAttachPoolToMarginInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[]
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedAttachPoolToMarginInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 6) {
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
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      solEscrow: getNextAccount(),
      owner: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getAttachPoolToMarginInstructionDataDecoder().decode(
      instruction.data
    ),
  };
}