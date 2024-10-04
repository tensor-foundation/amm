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
import { findAssetDepositReceiptPda } from '../pdas';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export type WithdrawNftCoreInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountAsset extends string | IAccountMeta<string> = string,
  TAccountCollection extends string | IAccountMeta<string> = string,
  TAccountMplCoreProgram extends
    | string
    | IAccountMeta<string> = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountAsset extends string
        ? WritableAccount<TAccountAsset>
        : TAccountAsset,
      TAccountCollection extends string
        ? ReadonlyAccount<TAccountCollection>
        : TAccountCollection,
      TAccountMplCoreProgram extends string
        ? ReadonlyAccount<TAccountMplCoreProgram>
        : TAccountMplCoreProgram,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner> &
            IAccountSignerMeta<TAccountOwner>
        : TAccountOwner,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountWhitelist extends string
        ? ReadonlyAccount<TAccountWhitelist>
        : TAccountWhitelist,
      TAccountMintProof extends string
        ? ReadonlyAccount<TAccountMintProof>
        : TAccountMintProof,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type WithdrawNftCoreInstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type WithdrawNftCoreInstructionDataArgs = {};

export function getWithdrawNftCoreInstructionDataEncoder(): Encoder<WithdrawNftCoreInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([['discriminator', fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([112, 131, 239, 116, 187, 149, 114, 145]),
    })
  );
}

export function getWithdrawNftCoreInstructionDataDecoder(): Decoder<WithdrawNftCoreInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getWithdrawNftCoreInstructionDataCodec(): Codec<
  WithdrawNftCoreInstructionDataArgs,
  WithdrawNftCoreInstructionData
> {
  return combineCodec(
    getWithdrawNftCoreInstructionDataEncoder(),
    getWithdrawNftCoreInstructionDataDecoder()
  );
}

export type WithdrawNftCoreAsyncInput<
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool the asset is being transferred to/from. */
  pool: Address<TAccountPool>;
  /**
   * The whitelist that gatekeeps which NFTs can be deposited into the pool.
   * Must match the whitelist stored in the pool state.
   */
  whitelist?: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export async function getWithdrawNftCoreInstructionAsync<
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountMplCoreProgram extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountNftReceipt extends string,
  TAccountSystemProgram extends string,
>(
  input: WithdrawNftCoreAsyncInput<
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountNftReceipt,
    TAccountSystemProgram
  >
): Promise<
  WithdrawNftCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountNftReceipt,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    asset: { value: input.asset ?? null, isWritable: true },
    collection: { value: input.collection ?? null, isWritable: false },
    mplCoreProgram: { value: input.mplCoreProgram ?? null, isWritable: false },
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolve default values.
  if (!accounts.mplCoreProgram.value) {
    accounts.mplCoreProgram.value =
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address<'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'>;
  }
  if (!accounts.nftReceipt.value) {
    accounts.nftReceipt.value = await findAssetDepositReceiptPda({
      asset: expectAddress(accounts.asset.value),
      pool: expectAddress(accounts.pool.value),
    });
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftCoreInstructionDataEncoder().encode({}),
  } as WithdrawNftCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountNftReceipt,
    TAccountSystemProgram
  >;

  return instruction;
}

export type WithdrawNftCoreInput<
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool the asset is being transferred to/from. */
  pool: Address<TAccountPool>;
  /**
   * The whitelist that gatekeeps which NFTs can be deposited into the pool.
   * Must match the whitelist stored in the pool state.
   */
  whitelist?: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
  nftReceipt: Address<TAccountNftReceipt>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export function getWithdrawNftCoreInstruction<
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountMplCoreProgram extends string,
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountNftReceipt extends string,
  TAccountSystemProgram extends string,
>(
  input: WithdrawNftCoreInput<
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountNftReceipt,
    TAccountSystemProgram
  >
): WithdrawNftCoreInstruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountAsset,
  TAccountCollection,
  TAccountMplCoreProgram,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountNftReceipt,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    asset: { value: input.asset ?? null, isWritable: true },
    collection: { value: input.collection ?? null, isWritable: false },
    mplCoreProgram: { value: input.mplCoreProgram ?? null, isWritable: false },
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Resolve default values.
  if (!accounts.mplCoreProgram.value) {
    accounts.mplCoreProgram.value =
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address<'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftCoreInstructionDataEncoder().encode({}),
  } as WithdrawNftCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountNftReceipt,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedWithdrawNftCoreInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The MPL core asset account. */
    asset: TAccountMetas[0];
    collection?: TAccountMetas[1] | undefined;
    /** The MPL Core program. */
    mplCoreProgram: TAccountMetas[2];
    /** The owner of the pool and the NFT. */
    owner: TAccountMetas[3];
    /** The pool the asset is being transferred to/from. */
    pool: TAccountMetas[4];
    /**
     * The whitelist that gatekeeps which NFTs can be deposited into the pool.
     * Must match the whitelist stored in the pool state.
     */

    whitelist?: TAccountMetas[5] | undefined;
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[6] | undefined;
    /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
    nftReceipt: TAccountMetas[7];
    /** The Solana system program. */
    systemProgram: TAccountMetas[8];
  };
  data: WithdrawNftCoreInstructionData;
};

export function parseWithdrawNftCoreInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedWithdrawNftCoreInstruction<TProgram, TAccountMetas> {
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
  const getNextOptionalAccount = () => {
    const accountMeta = getNextAccount();
    return accountMeta.address === TENSOR_AMM_PROGRAM_ADDRESS
      ? undefined
      : accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      asset: getNextAccount(),
      collection: getNextOptionalAccount(),
      mplCoreProgram: getNextAccount(),
      owner: getNextAccount(),
      pool: getNextAccount(),
      whitelist: getNextOptionalAccount(),
      mintProof: getNextOptionalAccount(),
      nftReceipt: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getWithdrawNftCoreInstructionDataDecoder().decode(instruction.data),
  };
}
