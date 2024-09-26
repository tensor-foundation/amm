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
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export type SellNftTradePoolCoreInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSeller extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountAsset extends string | IAccountMeta<string> = string,
  TAccountCollection extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountMakerBroker extends string | IAccountMeta<string> = string,
  TAccountTakerBroker extends string | IAccountMeta<string> = string,
  TAccountCosigner extends string | IAccountMeta<string> = string,
  TAccountMplCoreProgram extends
    | string
    | IAccountMeta<string> = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
  TAccountAmmProgram extends
    | string
    | IAccountMeta<string> = 'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg',
  TAccountEscrowProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountOwner extends string
        ? WritableAccount<TAccountOwner>
        : TAccountOwner,
      TAccountSeller extends string
        ? WritableSignerAccount<TAccountSeller> &
            IAccountSignerMeta<TAccountSeller>
        : TAccountSeller,
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
      TAccountAsset extends string
        ? WritableAccount<TAccountAsset>
        : TAccountAsset,
      TAccountCollection extends string
        ? ReadonlyAccount<TAccountCollection>
        : TAccountCollection,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
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
      TAccountMplCoreProgram extends string
        ? ReadonlyAccount<TAccountMplCoreProgram>
        : TAccountMplCoreProgram,
      TAccountAmmProgram extends string
        ? ReadonlyAccount<TAccountAmmProgram>
        : TAccountAmmProgram,
      TAccountEscrowProgram extends string
        ? ReadonlyAccount<TAccountEscrowProgram>
        : TAccountEscrowProgram,
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
  TAccountOwner extends string = string,
  TAccountSeller extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the buyer of the NFT, though the NFT will be escrowed by the pool. */
  owner: Address<TAccountOwner>;
  /** The seller is the owner of the NFT who is selling the NFT into the pool. */
  seller: TransactionSigner<TAccountSeller>;
  /** Fee vault account owned by the TFEE program. */
  feeVault?: Address<TAccountFeeVault>;
  /** The pool the NFT is sold into. */
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be sold into the pool. */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /** The shared escrow account for pools that pool liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /**
   * The optional cosigner account that must be passed in if the pool has a cosigner.
   * Missing check is performed in the handler.
   */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  escrowProgram?: Address<TAccountEscrowProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTradePoolCoreInstructionDataArgs['minPrice'];
  creators?: Array<Address>;
};

export async function getSellNftTradePoolCoreInstructionAsync<
  TAccountOwner extends string,
  TAccountSeller extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountNftReceipt extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountMplCoreProgram extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTradePoolCoreAsyncInput<
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountAsset,
    TAccountCollection,
    TAccountNftReceipt,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountMplCoreProgram,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountSystemProgram
  >
): Promise<
  SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountAsset,
    TAccountCollection,
    TAccountNftReceipt,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountMplCoreProgram,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    seller: { value: input.seller ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    asset: { value: input.asset ?? null, isWritable: true },
    collection: { value: input.collection ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    mplCoreProgram: { value: input.mplCoreProgram ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
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
  if (!accounts.feeVault.value) {
    accounts.feeVault = {
      ...accounts.feeVault,
      ...(await resolveFeeVaultPdaFromPool(resolverScope)),
    };
  }
  if (!accounts.nftReceipt.value) {
    accounts.nftReceipt.value = await findAssetDepositReceiptPda({
      asset: expectAddress(accounts.asset.value),
      pool: expectAddress(accounts.pool.value),
    });
  }
  if (!accounts.mplCoreProgram.value) {
    accounts.mplCoreProgram.value =
      'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d' as Address<'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'>;
  }
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>;
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
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.seller),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTradePoolCoreInstructionDataEncoder().encode(
      args as SellNftTradePoolCoreInstructionDataArgs
    ),
  } as SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountAsset,
    TAccountCollection,
    TAccountNftReceipt,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountMplCoreProgram,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type SellNftTradePoolCoreInput<
  TAccountOwner extends string = string,
  TAccountSeller extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountAsset extends string = string,
  TAccountCollection extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountMplCoreProgram extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the buyer of the NFT, though the NFT will be escrowed by the pool. */
  owner: Address<TAccountOwner>;
  /** The seller is the owner of the NFT who is selling the NFT into the pool. */
  seller: TransactionSigner<TAccountSeller>;
  /** Fee vault account owned by the TFEE program. */
  feeVault: Address<TAccountFeeVault>;
  /** The pool the NFT is sold into. */
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be sold into the pool. */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The MPL core asset account. */
  asset: Address<TAccountAsset>;
  collection?: Address<TAccountCollection>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  /** The shared escrow account for pools that pool liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /**
   * The optional cosigner account that must be passed in if the pool has a cosigner.
   * Missing check is performed in the handler.
   */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The MPL Core program. */
  mplCoreProgram?: Address<TAccountMplCoreProgram>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  escrowProgram?: Address<TAccountEscrowProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTradePoolCoreInstructionDataArgs['minPrice'];
  creators?: Array<Address>;
};

export function getSellNftTradePoolCoreInstruction<
  TAccountOwner extends string,
  TAccountSeller extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountAsset extends string,
  TAccountCollection extends string,
  TAccountNftReceipt extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountMplCoreProgram extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTradePoolCoreInput<
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountAsset,
    TAccountCollection,
    TAccountNftReceipt,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountMplCoreProgram,
    TAccountAmmProgram,
    TAccountEscrowProgram,
    TAccountSystemProgram
  >
): SellNftTradePoolCoreInstruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountSeller,
  TAccountFeeVault,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountAsset,
  TAccountCollection,
  TAccountNftReceipt,
  TAccountSharedEscrow,
  TAccountMakerBroker,
  TAccountTakerBroker,
  TAccountCosigner,
  TAccountMplCoreProgram,
  TAccountAmmProgram,
  TAccountEscrowProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    seller: { value: input.seller ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    asset: { value: input.asset ?? null, isWritable: true },
    collection: { value: input.collection ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    mplCoreProgram: { value: input.mplCoreProgram ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
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
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>;
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
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.seller),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.asset),
      getAccountMeta(accounts.collection),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.mplCoreProgram),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTradePoolCoreInstructionDataEncoder().encode(
      args as SellNftTradePoolCoreInstructionDataArgs
    ),
  } as SellNftTradePoolCoreInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountAsset,
    TAccountCollection,
    TAccountNftReceipt,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountMplCoreProgram,
    TAccountAmmProgram,
    TAccountEscrowProgram,
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
    /** The owner of the pool and the buyer of the NFT, though the NFT will be escrowed by the pool. */
    owner: TAccountMetas[0];
    /** The seller is the owner of the NFT who is selling the NFT into the pool. */
    seller: TAccountMetas[1];
    /** Fee vault account owned by the TFEE program. */
    feeVault: TAccountMetas[2];
    /** The pool the NFT is sold into. */
    pool: TAccountMetas[3];
    /** The whitelist that gatekeeps which NFTs can be sold into the pool. */
    whitelist: TAccountMetas[4];
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[5] | undefined;
    /** The MPL core asset account. */
    asset: TAccountMetas[6];
    collection?: TAccountMetas[7] | undefined;
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[8];
    /** The shared escrow account for pools that pool liquidity in a shared account. */
    sharedEscrow?: TAccountMetas[9] | undefined;
    /** The account that receives the maker broker fee. */
    makerBroker?: TAccountMetas[10] | undefined;
    /** The account that receives the taker broker fee. */
    takerBroker?: TAccountMetas[11] | undefined;
    /**
     * The optional cosigner account that must be passed in if the pool has a cosigner.
     * Missing check is performed in the handler.
     */

    cosigner?: TAccountMetas[12] | undefined;
    /** The MPL Core program. */
    mplCoreProgram: TAccountMetas[13];
    /** The AMM program account, used for self-cpi logging. */
    ammProgram: TAccountMetas[14];
    escrowProgram?: TAccountMetas[15] | undefined;
    /** The Solana system program. */
    systemProgram: TAccountMetas[16];
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
  if (instruction.accounts.length < 17) {
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
      owner: getNextAccount(),
      seller: getNextAccount(),
      feeVault: getNextAccount(),
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      mintProof: getNextOptionalAccount(),
      asset: getNextAccount(),
      collection: getNextOptionalAccount(),
      nftReceipt: getNextAccount(),
      sharedEscrow: getNextOptionalAccount(),
      makerBroker: getNextOptionalAccount(),
      takerBroker: getNextOptionalAccount(),
      cosigner: getNextOptionalAccount(),
      mplCoreProgram: getNextAccount(),
      ammProgram: getNextAccount(),
      escrowProgram: getNextOptionalAccount(),
      systemProgram: getNextAccount(),
    },
    data: getSellNftTradePoolCoreInstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
