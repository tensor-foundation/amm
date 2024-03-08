/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Address,
  getAddressDecoder,
  getAddressEncoder,
} from '@solana/addresses';
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
import {
  getU32Decoder,
  getU32Encoder,
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
import {
  Option,
  OptionOrNullable,
  getOptionDecoder,
  getOptionEncoder,
} from '@solana/options';
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

export type EditPoolInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner>
        : TAccountOwner,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts
    ]
  >;

export type EditPoolInstructionWithSigners<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
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

export type EditPoolInstructionData = {
  discriminator: Array<number>;
  newConfig: Option<PoolConfig>;
  cosigner: Option<Address>;
  maxTakerSellCount: Option<number>;
};

export type EditPoolInstructionDataArgs = {
  newConfig: OptionOrNullable<PoolConfigArgs>;
  cosigner: OptionOrNullable<Address>;
  maxTakerSellCount: OptionOrNullable<number>;
};

export function getEditPoolInstructionDataEncoder(): Encoder<EditPoolInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['newConfig', getOptionEncoder(getPoolConfigEncoder())],
      ['cosigner', getOptionEncoder(getAddressEncoder())],
      ['maxTakerSellCount', getOptionEncoder(getU32Encoder())],
    ]),
    (value) => ({ ...value, discriminator: [50, 174, 34, 36, 3, 166, 29, 204] })
  );
}

export function getEditPoolInstructionDataDecoder(): Decoder<EditPoolInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['newConfig', getOptionDecoder(getPoolConfigDecoder())],
    ['cosigner', getOptionDecoder(getAddressDecoder())],
    ['maxTakerSellCount', getOptionDecoder(getU32Decoder())],
  ]);
}

export function getEditPoolInstructionDataCodec(): Codec<
  EditPoolInstructionDataArgs,
  EditPoolInstructionData
> {
  return combineCodec(
    getEditPoolInstructionDataEncoder(),
    getEditPoolInstructionDataDecoder()
  );
}

export type EditPoolInput<
  TAccountPool extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  pool: Address<TAccountPool>;
  owner: Address<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  newConfig: EditPoolInstructionDataArgs['newConfig'];
  cosigner: EditPoolInstructionDataArgs['cosigner'];
  maxTakerSellCount: EditPoolInstructionDataArgs['maxTakerSellCount'];
};

export type EditPoolInputWithSigners<
  TAccountPool extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string
> = {
  pool: Address<TAccountPool>;
  owner: TransactionSigner<TAccountOwner>;
  systemProgram?: Address<TAccountSystemProgram>;
  newConfig: EditPoolInstructionDataArgs['newConfig'];
  cosigner: EditPoolInstructionDataArgs['cosigner'];
  maxTakerSellCount: EditPoolInstructionDataArgs['maxTakerSellCount'];
};

export function getEditPoolInstruction<
  TAccountPool extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: EditPoolInputWithSigners<
    TAccountPool,
    TAccountOwner,
    TAccountSystemProgram
  >
): EditPoolInstructionWithSigners<
  TProgram,
  TAccountPool,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getEditPoolInstruction<
  TAccountPool extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: EditPoolInput<TAccountPool, TAccountOwner, TAccountSystemProgram>
): EditPoolInstruction<
  TProgram,
  TAccountPool,
  TAccountOwner,
  TAccountSystemProgram
>;
export function getEditPoolInstruction<
  TAccountPool extends string,
  TAccountOwner extends string,
  TAccountSystemProgram extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: EditPoolInput<TAccountPool, TAccountOwner, TAccountSystemProgram>
): IInstruction {
  // Program address.
  const programAddress =
    'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

  // Original accounts.
  type AccountMetas = Parameters<
    typeof getEditPoolInstructionRaw<
      TProgram,
      TAccountPool,
      TAccountOwner,
      TAccountSystemProgram
    >
  >[0];
  const accounts: Record<keyof AccountMetas, ResolvedAccount> = {
    pool: { value: input.pool ?? null, isWritable: true },
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

  const instruction = getEditPoolInstructionRaw(
    accountMetas as Record<keyof AccountMetas, IAccountMeta>,
    args as EditPoolInstructionDataArgs,
    programAddress
  );

  return instruction;
}

export function getEditPoolInstructionRaw<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
>(
  accounts: {
    pool: TAccountPool extends string ? Address<TAccountPool> : TAccountPool;
    owner: TAccountOwner extends string
      ? Address<TAccountOwner>
      : TAccountOwner;
    systemProgram?: TAccountSystemProgram extends string
      ? Address<TAccountSystemProgram>
      : TAccountSystemProgram;
  },
  args: EditPoolInstructionDataArgs,
  programAddress: Address<TProgram> = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<TProgram>,
  remainingAccounts?: TRemainingAccounts
) {
  return {
    accounts: [
      accountMetaWithDefault(accounts.pool, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.owner, AccountRole.WRITABLE_SIGNER),
      accountMetaWithDefault(
        accounts.systemProgram ??
          ('11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>),
        AccountRole.READONLY
      ),
      ...(remainingAccounts ?? []),
    ],
    data: getEditPoolInstructionDataEncoder().encode(args),
    programAddress,
  } as EditPoolInstruction<
    TProgram,
    TAccountPool,
    TAccountOwner,
    TAccountSystemProgram,
    TRemainingAccounts
  >;
}

export type ParsedEditPoolInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[]
> = {
  programAddress: Address<TProgram>;
  accounts: {
    pool: TAccountMetas[0];
    owner: TAccountMetas[1];
    systemProgram: TAccountMetas[2];
  };
  data: EditPoolInstructionData;
};

export function parseEditPoolInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[]
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedEditPoolInstruction<TProgram, TAccountMetas> {
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
      pool: getNextAccount(),
      owner: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getEditPoolInstructionDataDecoder().decode(instruction.data),
  };
}
