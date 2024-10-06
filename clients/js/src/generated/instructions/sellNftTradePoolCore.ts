/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/kinobi-so/kinobi
 */

import {
  AccountRole,
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
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
  type ReadonlySignerAccount,
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import { resolveFeeVaultPdaFromPool } from '../../hooked';
import { findAssetDepositReceiptPda } from '../pdas';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export type SellNftTradePoolCoreInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountAsset extends string | IAccountMeta<string> = string,
  TAccountCollection extends string | IAccountMeta<string> = string,
  TAccountMplCoreProgram extends
    | string
    | IAccountMeta<string> = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountTaker extends string | IAccountMeta<string> = string,
  TAccountRentPayer extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountMakerBroker extends string | IAccountMeta<string> = string,
  TAccountTakerBroker extends string | IAccountMeta<string> = string,
  TAccountCosigner extends string | IAccountMeta<string> = string,
  TAccountAmmProgram extends
    | string
    | IAccountMeta<string> = 'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg',
  TAccountEscrowProgram extends string | IAccountMeta<string> = string,
  TAccountNativeProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
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
        ? WritableAccount<TAccountOwner>
        : TAccountOwner,
      TAccountTaker extends string
        ? WritableSignerAccount<TAccountTaker> &
            IAccountSignerMeta<TAccountTaker>
        : TAccountTaker,
      TAccountRentPayer extends string
        ? WritableAccount<TAccountRentPayer>
        : TAccountRentPayer,
      TAccountFeeVault extends string
        ? WritableAccount<TAccountFeeVault>
        : TAccountFeeVault,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountWhitelist extends string
        ? ReadonlyAccount<TAccountWhitelist>
        : TAccountWhitelist,
      TAccountMintProof extends string
        ? ReadonlyAccount<TAccountMintProof>
        : TAccountMintProof,
      TAccountSharedEscrow extends string
        ? WritableAccount<TAccountSharedEscrow>
        : TAccountSharedEscrow,
      TAccountMakerBroker extends string
        ? WritableAccount<TAccountMakerBroker>
        : TAccountMakerBroker,
      TAccountTakerBroker extends string
        ? WritableAccount<TAccountTakerBroker>
        : TAccountTakerBroker,
      TAccountCosigner extends string
        ? ReadonlySignerAccount<TAccountCosigner> &
            IAccountSignerMeta<TAccountCosigner>
        : TAccountCosigner,
      TAccountAmmProgram extends string
        ? ReadonlyAccount<TAccountAmmProgram>
        : TAccountAmmProgram,
      TAccountEscrowProgram extends string
        ? ReadonlyAccount<TAccountEscrowProgram>
        : TAccountEscrowProgram,
      TAccountNativeProgram extends string
        ? ReadonlyAccount<TAccountNativeProgram>
        : TAccountNativeProgram,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type SellNftTradePoolCoreInstructionData = {
  discriminator: ReadonlyUint8Array;
  minPrice: bigint;
};

export type SellNftTradePoolCoreInstructionDataArgs = {
  minPrice: number | bigint;
};

export function getSellNftTradePoolCoreInstructionDataEncoder(): Encoder<SellNftTradePoolCoreInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['minPrice', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([37, 205, 141, 53, 86, 245, 45, 78]),
    })
  );
}

export function getSellNftTradePoolCoreInstructionDataDecoder(): Decoder<SellNftTradePoolCoreInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['minPrice', getU64Decoder()],
  ]);
}

export function getSellNftTradePoolCoreInstructionDataCodec(): Codec<
  SellNftTradePoolCoreInstructionDataArgs,
  SellNftTradePoolCoreInstructionData
> {
  return combineCodec(
    getSellNftTradePoolCoreInstructionDataEncoder(),
    getSellNftTradePoolCoreInstructionDataDecoder()
  );
}

export type SellNftTradePoolCoreAsyncInput<
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountOwner extends string = string,
  TAccountTaker extends string = string,
  TAccountRentPayer extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
  TAccountNativeProgram extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The owner of the pool and the buyer/recipient of the NFT. */
  owner: Address<TAccountOwner>;
  /** The taker is the user buying or selling the NFT. */
  taker: TransactionSigner<TAccountTaker>;
  /**
   * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
   * is auto-closed.
   */
  rentPayer?: Address<TAccountRentPayer>;
  /** Fee vault account owned by the TFEE program. */
  feeVault?: Address<TAccountFeeVault>;
  /**
   * The Pool state account that the NFT is being sold into. Stores pool state and config,
   * but is also the owner of any NFTs in the pool, and also escrows any SOL.
   * Any active pool can be specified provided it is a Token type and the NFT passes at least one
   * whitelist condition.
   */
  pool: Address<TAccountPool>;
  /** The whitelist account that the pool uses to verify the NFTs being sold into it. */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The shared escrow account for pools that have liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /** The optional cosigner account that must be passed in if the pool has a cosigner. */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  /** The escrow program account for shared liquidity pools. */
  escrowProgram?: Address<TAccountEscrowProgram>;
  nativeProgram?: Address<TAccountNativeProgram>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt?: Address<TAccountNftReceipt>;
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTradePoolCoreInstructionDataArgs['minPrice'];
  creators?: Array<Address>;
};

export async function getSellNftTradePoolCoreInstructionAsync<
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountMplCoreProgram extends string,
  TAccountOwner extends string,
  TAccountTaker extends string,
  TAccountRentPayer extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
  TAccountNativeProgram extends string,
  TAccountNftReceipt extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTradePoolCoreAsyncInput<
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountTaker,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountNativeProgram,
    TAccountNftReceipt,
    TAccountSystemProgram
  >
): Promise<
  SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountTaker,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountNativeProgram,
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
    taker: { value: input.taker ?? null, isWritable: true },
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
    nativeProgram: { value: input.nativeProgram ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
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
  if (!accounts.mplCoreProgram.value) {
    accounts.mplCoreProgram.value =
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address<'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'>;
  }
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
  if (!accounts.feeVault.value) {
    accounts.feeVault = {
      ...accounts.feeVault,
      ...(await resolveFeeVaultPdaFromPool(resolverScope)),
    };
  }
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>;
  }
  if (!accounts.nativeProgram.value) {
    accounts.nativeProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
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

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = (args.creators ?? []).map(
    (address) => ({ address, role: AccountRole.WRITABLE })
  );

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.taker),
      getAccountMeta(accounts.rentPayer),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
      getAccountMeta(accounts.nativeProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTradePoolCoreInstructionDataEncoder().encode(
      args as SellNftTradePoolCoreInstructionDataArgs
    ),
  } as SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountTaker,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountNativeProgram,
    TAccountNftReceipt,
    TAccountSystemProgram
  >;

  return instruction;
}

export type SellNftTradePoolCoreInput<
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountOwner extends string = string,
  TAccountTaker extends string = string,
  TAccountRentPayer extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
  TAccountNativeProgram extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The owner of the pool and the buyer/recipient of the NFT. */
  owner: Address<TAccountOwner>;
  /** The taker is the user buying or selling the NFT. */
  taker: TransactionSigner<TAccountTaker>;
  /**
   * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
   * is auto-closed.
   */
  rentPayer?: Address<TAccountRentPayer>;
  /** Fee vault account owned by the TFEE program. */
  feeVault: Address<TAccountFeeVault>;
  /**
   * The Pool state account that the NFT is being sold into. Stores pool state and config,
   * but is also the owner of any NFTs in the pool, and also escrows any SOL.
   * Any active pool can be specified provided it is a Token type and the NFT passes at least one
   * whitelist condition.
   */
  pool: Address<TAccountPool>;
  /** The whitelist account that the pool uses to verify the NFTs being sold into it. */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The shared escrow account for pools that have liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /** The optional cosigner account that must be passed in if the pool has a cosigner. */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  /** The escrow program account for shared liquidity pools. */
  escrowProgram?: Address<TAccountEscrowProgram>;
  nativeProgram?: Address<TAccountNativeProgram>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTradePoolCoreInstructionDataArgs['minPrice'];
  creators?: Array<Address>;
};

export function getSellNftTradePoolCoreInstruction<
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountMplCoreProgram extends string,
  TAccountOwner extends string,
  TAccountTaker extends string,
  TAccountRentPayer extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
  TAccountNativeProgram extends string,
  TAccountNftReceipt extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTradePoolCoreInput<
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountTaker,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountNativeProgram,
    TAccountNftReceipt,
    TAccountSystemProgram
  >
): SellNftTradePoolCoreInstruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountAsset,
  TAccountCollection,
  TAccountMplCoreProgram,
  TAccountOwner,
  TAccountTaker,
  TAccountRentPayer,
  TAccountFeeVault,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountSharedEscrow,
  TAccountMakerBroker,
  TAccountTakerBroker,
  TAccountCosigner,
  TAccountAmmProgram,
  TAccountEscrowProgram,
  TAccountNativeProgram,
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
    taker: { value: input.taker ?? null, isWritable: true },
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
    nativeProgram: { value: input.nativeProgram ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.mplCoreProgram.value) {
    accounts.mplCoreProgram.value =
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address<'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'>;
  }
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>;
  }
  if (!accounts.nativeProgram.value) {
    accounts.nativeProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = (args.creators ?? []).map(
    (address) => ({ address, role: AccountRole.WRITABLE })
  );

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.taker),
      getAccountMeta(accounts.rentPayer),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
      getAccountMeta(accounts.nativeProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTradePoolCoreInstructionDataEncoder().encode(
      args as SellNftTradePoolCoreInstructionDataArgs
    ),
  } as SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountAsset,
    TAccountCollection,
    TAccountMplCoreProgram,
    TAccountOwner,
    TAccountTaker,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountNativeProgram,
    TAccountNftReceipt,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedSellNftTradePoolCoreInstruction<
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
    /** The owner of the pool and the buyer/recipient of the NFT. */
    owner: TAccountMetas[3];
    /** The taker is the user buying or selling the NFT. */
    taker: TAccountMetas[4];
    /**
     * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
     * is auto-closed.
     */

    rentPayer: TAccountMetas[5];
    /** Fee vault account owned by the TFEE program. */
    feeVault: TAccountMetas[6];
    /**
     * The Pool state account that the NFT is being sold into. Stores pool state and config,
     * but is also the owner of any NFTs in the pool, and also escrows any SOL.
     * Any active pool can be specified provided it is a Token type and the NFT passes at least one
     * whitelist condition.
     */

    pool: TAccountMetas[7];
    /** The whitelist account that the pool uses to verify the NFTs being sold into it. */
    whitelist: TAccountMetas[8];
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[9] | undefined;
    /** The shared escrow account for pools that have liquidity in a shared account. */
    sharedEscrow?: TAccountMetas[10] | undefined;
    /** The account that receives the maker broker fee. */
    makerBroker?: TAccountMetas[11] | undefined;
    /** The account that receives the taker broker fee. */
    takerBroker?: TAccountMetas[12] | undefined;
    /** The optional cosigner account that must be passed in if the pool has a cosigner. */
    cosigner?: TAccountMetas[13] | undefined;
    /** The AMM program account, used for self-cpi logging. */
    ammProgram: TAccountMetas[14];
    /** The escrow program account for shared liquidity pools. */
    escrowProgram?: TAccountMetas[15] | undefined;
    nativeProgram: TAccountMetas[16];
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[17];
    systemProgram: TAccountMetas[18];
  };
  data: SellNftTradePoolCoreInstructionData;
};

export function parseSellNftTradePoolCoreInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedSellNftTradePoolCoreInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 19) {
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
      taker: getNextAccount(),
      rentPayer: getNextAccount(),
      feeVault: getNextAccount(),
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      mintProof: getNextOptionalAccount(),
      sharedEscrow: getNextOptionalAccount(),
      makerBroker: getNextOptionalAccount(),
      takerBroker: getNextOptionalAccount(),
      cosigner: getNextOptionalAccount(),
      ammProgram: getNextAccount(),
      escrowProgram: getNextOptionalAccount(),
      nativeProgram: getNextAccount(),
      nftReceipt: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getSellNftTradePoolCoreInstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
