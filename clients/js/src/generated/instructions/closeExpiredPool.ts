/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
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
  type IInstruction,
  type IInstructionWithAccounts,
  type IInstructionWithData,
  type ReadonlyAccount,
  type ReadonlyUint8Array,
  type WritableAccount,
} from '@solana/web3.js';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export const CLOSE_EXPIRED_POOL_DISCRIMINATOR = new Uint8Array([
  108, 212, 233, 53, 132, 83, 63, 219,
]);

export function getCloseExpiredPoolDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLOSE_EXPIRED_POOL_DISCRIMINATOR
  );
}

export type CloseExpiredPoolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
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
        ? WritableAccount<TAccountRentPayer>
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

export type CloseExpiredPoolInstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type CloseExpiredPoolInstructionDataArgs = {};

export function getCloseExpiredPoolInstructionDataEncoder(): Encoder<CloseExpiredPoolInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([['discriminator', fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({ ...value, discriminator: CLOSE_EXPIRED_POOL_DISCRIMINATOR })
  );
}

export function getCloseExpiredPoolInstructionDataDecoder(): Decoder<CloseExpiredPoolInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
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
  /** The rent payer to refund pool rent to. */
  rentPayer?: Address<TAccountRentPayer>;
  /**
   * The owner account must be specified and match the account stored in the pool but does not have to sign
   * for expired pools.
   */
  owner: Address<TAccountOwner>;
  /** The pool to close. */
  pool: Address<TAccountPool>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export function getCloseExpiredPoolInstruction<
  TAccountRentPayer extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof TENSOR_AMM_PROGRAM_ADDRESS,
>(
  input: CloseExpiredPoolInput<
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): CloseExpiredPoolInstruction<
  TProgramAddress,
  TAccountRentPayer,
  TAccountOwner,
  TAccountPool,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = config?.programAddress ?? TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolve default values.
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
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
    TProgramAddress,
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedCloseExpiredPoolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The rent payer to refund pool rent to. */
    rentPayer: TAccountMetas[0];
    /**
     * The owner account must be specified and match the account stored in the pool but does not have to sign
     * for expired pools.
     */

    owner: TAccountMetas[1];
    /** The pool to close. */
    pool: TAccountMetas[2];
    /** The Solana system program. */
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
