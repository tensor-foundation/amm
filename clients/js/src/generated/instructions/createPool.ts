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
  getAddressDecoder,
  getAddressEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getOptionDecoder,
  getOptionEncoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  none,
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
  type Option,
  type OptionOrNullable,
  type ReadonlyAccount,
  type ReadonlySignerAccount,
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import { resolvePoolIdOnCreate } from '../../hooked';
import { findPoolPda } from '../pdas';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';
import {
  getPoolConfigDecoder,
  getPoolConfigEncoder,
  type PoolConfig,
  type PoolConfigArgs,
} from '../types';

export const CREATE_POOL_DISCRIMINATOR = new Uint8Array([
  233, 146, 209, 142, 207, 104, 64, 188,
]);

export function getCreatePoolDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(CREATE_POOL_DISCRIMINATOR);
}

export type CreatePoolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountRentPayer extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountRentPayer extends string
        ? WritableSignerAccount<TAccountRentPayer> &
            IAccountSignerMeta<TAccountRentPayer>
        : TAccountRentPayer,
      TAccountOwner extends string
        ? ReadonlySignerAccount<TAccountOwner> &
            IAccountSignerMeta<TAccountOwner>
        : TAccountOwner,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountWhitelist extends string
        ? ReadonlyAccount<TAccountWhitelist>
        : TAccountWhitelist,
      TAccountSharedEscrow extends string
        ? ReadonlyAccount<TAccountSharedEscrow>
        : TAccountSharedEscrow,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type CreatePoolInstructionData = {
  discriminator: ReadonlyUint8Array;
  poolId: ReadonlyUint8Array;
  config: PoolConfig;
  currency: Option<Address>;
  cosigner: Option<Address>;
  makerBroker: Option<Address>;
  maxTakerSellCount: Option<number>;
  expireInSec: Option<bigint>;
};

export type CreatePoolInstructionDataArgs = {
  poolId: ReadonlyUint8Array;
  config: PoolConfigArgs;
  currency?: OptionOrNullable<Address>;
  cosigner?: OptionOrNullable<Address>;
  makerBroker?: OptionOrNullable<Address>;
  maxTakerSellCount?: OptionOrNullable<number>;
  expireInSec?: OptionOrNullable<number | bigint>;
};

export function getCreatePoolInstructionDataEncoder(): Encoder<CreatePoolInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['poolId', fixEncoderSize(getBytesEncoder(), 32)],
      ['config', getPoolConfigEncoder()],
      ['currency', getOptionEncoder(getAddressEncoder())],
      ['cosigner', getOptionEncoder(getAddressEncoder())],
      ['makerBroker', getOptionEncoder(getAddressEncoder())],
      ['maxTakerSellCount', getOptionEncoder(getU32Encoder())],
      ['expireInSec', getOptionEncoder(getU64Encoder())],
    ]),
    (value) => ({
      ...value,
      discriminator: CREATE_POOL_DISCRIMINATOR,
      currency: value.currency ?? none(),
      cosigner: value.cosigner ?? none(),
      makerBroker: value.makerBroker ?? none(),
      maxTakerSellCount: value.maxTakerSellCount ?? none(),
      expireInSec: value.expireInSec ?? none(),
    })
  );
}

export function getCreatePoolInstructionDataDecoder(): Decoder<CreatePoolInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['poolId', fixDecoderSize(getBytesDecoder(), 32)],
    ['config', getPoolConfigDecoder()],
    ['currency', getOptionDecoder(getAddressDecoder())],
    ['cosigner', getOptionDecoder(getAddressDecoder())],
    ['makerBroker', getOptionDecoder(getAddressDecoder())],
    ['maxTakerSellCount', getOptionDecoder(getU32Decoder())],
    ['expireInSec', getOptionDecoder(getU64Decoder())],
  ]);
}

export function getCreatePoolInstructionDataCodec(): Codec<
  CreatePoolInstructionDataArgs,
  CreatePoolInstructionData
> {
  return combineCodec(
    getCreatePoolInstructionDataEncoder(),
    getCreatePoolInstructionDataDecoder()
  );
}

export type CreatePoolAsyncInput<
  TAccountRentPayer extends string = string,
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /**
   * The account that pays for the rent to open the pool. This will be stored on the pool
   * so it can be refunded when the pool is closed.
   */
  rentPayer?: TransactionSigner<TAccountRentPayer>;
  /** The owner of the pool will be stored and used to control permissioned pool instructions. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool state account. */
  pool?: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be bought or sold with this pool. */
  whitelist: Address<TAccountWhitelist>;
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  poolId?: CreatePoolInstructionDataArgs['poolId'];
  config: CreatePoolInstructionDataArgs['config'];
  currency?: CreatePoolInstructionDataArgs['currency'];
  cosigner?: CreatePoolInstructionDataArgs['cosigner'];
  makerBroker?: CreatePoolInstructionDataArgs['makerBroker'];
  maxTakerSellCount?: CreatePoolInstructionDataArgs['maxTakerSellCount'];
  expireInSec?: CreatePoolInstructionDataArgs['expireInSec'];
};

export async function getCreatePoolInstructionAsync<
  TAccountRentPayer extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSharedEscrow extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof TENSOR_AMM_PROGRAM_ADDRESS,
>(
  input: CreatePoolAsyncInput<
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountSharedEscrow,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): Promise<
  CreatePoolInstruction<
    TProgramAddress,
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountSharedEscrow,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = config?.programAddress ?? TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    owner: { value: input.owner ?? null, isWritable: false },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: false },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolver scope.
  const resolverScope = { programAddress, accounts, args };

  // Resolve default values.
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
  if (!args.poolId) {
    args.poolId = resolvePoolIdOnCreate(resolverScope);
  }
  if (!accounts.pool.value) {
    accounts.pool.value = await findPoolPda({
      owner: expectAddress(accounts.owner.value),
      poolId: expectSome(args.poolId),
    });
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
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getCreatePoolInstructionDataEncoder().encode(
      args as CreatePoolInstructionDataArgs
    ),
  } as CreatePoolInstruction<
    TProgramAddress,
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountSharedEscrow,
    TAccountSystemProgram
  >;

  return instruction;
}

export type CreatePoolInput<
  TAccountRentPayer extends string = string,
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /**
   * The account that pays for the rent to open the pool. This will be stored on the pool
   * so it can be refunded when the pool is closed.
   */
  rentPayer?: TransactionSigner<TAccountRentPayer>;
  /** The owner of the pool will be stored and used to control permissioned pool instructions. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool state account. */
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be bought or sold with this pool. */
  whitelist: Address<TAccountWhitelist>;
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  poolId?: CreatePoolInstructionDataArgs['poolId'];
  config: CreatePoolInstructionDataArgs['config'];
  currency?: CreatePoolInstructionDataArgs['currency'];
  cosigner?: CreatePoolInstructionDataArgs['cosigner'];
  makerBroker?: CreatePoolInstructionDataArgs['makerBroker'];
  maxTakerSellCount?: CreatePoolInstructionDataArgs['maxTakerSellCount'];
  expireInSec?: CreatePoolInstructionDataArgs['expireInSec'];
};

export function getCreatePoolInstruction<
  TAccountRentPayer extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountSharedEscrow extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof TENSOR_AMM_PROGRAM_ADDRESS,
>(
  input: CreatePoolInput<
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountSharedEscrow,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): CreatePoolInstruction<
  TProgramAddress,
  TAccountRentPayer,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountSharedEscrow,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = config?.programAddress ?? TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    owner: { value: input.owner ?? null, isWritable: false },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: false },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolver scope.
  const resolverScope = { programAddress, accounts, args };

  // Resolve default values.
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
  if (!args.poolId) {
    args.poolId = resolvePoolIdOnCreate(resolverScope);
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
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getCreatePoolInstructionDataEncoder().encode(
      args as CreatePoolInstructionDataArgs
    ),
  } as CreatePoolInstruction<
    TProgramAddress,
    TAccountRentPayer,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountSharedEscrow,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedCreatePoolInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /**
     * The account that pays for the rent to open the pool. This will be stored on the pool
     * so it can be refunded when the pool is closed.
     */

    rentPayer: TAccountMetas[0];
    /** The owner of the pool will be stored and used to control permissioned pool instructions. */
    owner: TAccountMetas[1];
    /** The pool state account. */
    pool: TAccountMetas[2];
    /** The whitelist that gatekeeps which NFTs can be bought or sold with this pool. */
    whitelist: TAccountMetas[3];
    sharedEscrow?: TAccountMetas[4] | undefined;
    /** The Solana system program. */
    systemProgram: TAccountMetas[5];
  };
  data: CreatePoolInstructionData;
};

export function parseCreatePoolInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedCreatePoolInstruction<TProgram, TAccountMetas> {
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
  const getNextOptionalAccount = () => {
    const accountMeta = getNextAccount();
    return accountMeta.address === TENSOR_AMM_PROGRAM_ADDRESS
      ? undefined
      : accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      rentPayer: getNextAccount(),
      owner: getNextAccount(),
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      sharedEscrow: getNextOptionalAccount(),
      systemProgram: getNextAccount(),
    },
    data: getCreatePoolInstructionDataDecoder().decode(instruction.data),
  };
}
