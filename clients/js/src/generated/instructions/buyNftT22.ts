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
import {
  resolveBuyerAta,
  resolvePoolAta,
  resolvePoolNftReceipt,
} from '@tensor-foundation/resolvers';
import { resolveFeeVaultPdaFromPool } from '../../hooked';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export type BuyNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountBuyer extends string | IAccountMeta<string> = string,
  TAccountRentPayer extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountBuyerTa extends string | IAccountMeta<string> = string,
  TAccountPoolTa extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends
    | string
    | IAccountMeta<string> = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountMakerBroker extends string | IAccountMeta<string> = string,
  TAccountTakerBroker extends string | IAccountMeta<string> = string,
  TAccountCosigner extends string | IAccountMeta<string> = string,
  TAccountAmmProgram extends
    | string
    | IAccountMeta<string> = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountOwner extends string
        ? WritableAccount<TAccountOwner>
        : TAccountOwner,
      TAccountBuyer extends string
        ? WritableSignerAccount<TAccountBuyer> &
            IAccountSignerMeta<TAccountBuyer>
        : TAccountBuyer,
      TAccountRentPayer extends string
        ? WritableAccount<TAccountRentPayer>
        : TAccountRentPayer,
      TAccountFeeVault extends string
        ? WritableAccount<TAccountFeeVault>
        : TAccountFeeVault,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountBuyerTa extends string
        ? WritableAccount<TAccountBuyerTa>
        : TAccountBuyerTa,
      TAccountPoolTa extends string
        ? WritableAccount<TAccountPoolTa>
        : TAccountPoolTa,
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
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
      ...TRemainingAccounts,
    ]
  >;

export type BuyNftT22InstructionData = {
  discriminator: ReadonlyUint8Array;
  maxAmount: bigint;
};

export type BuyNftT22InstructionDataArgs = { maxAmount: number | bigint };

export function getBuyNftT22InstructionDataEncoder(): Encoder<BuyNftT22InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['maxAmount', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([155, 219, 126, 245, 170, 199, 51, 79]),
    })
  );
}

export function getBuyNftT22InstructionDataDecoder(): Decoder<BuyNftT22InstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['maxAmount', getU64Decoder()],
  ]);
}

export function getBuyNftT22InstructionDataCodec(): Codec<
  BuyNftT22InstructionDataArgs,
  BuyNftT22InstructionData
> {
  return combineCodec(
    getBuyNftT22InstructionDataEncoder(),
    getBuyNftT22InstructionDataDecoder()
  );
}

export type BuyNftT22AsyncInput<
  TAccountOwner extends string = string,
  TAccountBuyer extends string = string,
  TAccountRentPayer extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountBuyerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountMint extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
> = {
  /**
   * Owner is the pool owner who created the pool and the nominal owner of the
   * escrowed NFT. In this transaction they are the seller, though the transfer
   * of the NFT is handled by the pool.
   */
  owner: Address<TAccountOwner>;
  /** Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT. */
  buyer: TransactionSigner<TAccountBuyer>;
  /**
   * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
   * is auto-closed.
   */
  rentPayer?: Address<TAccountRentPayer>;
  /** Fee vault account owned by the TFEE program. */
  feeVault?: Address<TAccountFeeVault>;
  /**
   * The Pool state account that holds the NFT to be purchased. Stores pool state and config,
   * but is also the owner of any NFTs in the pool, and also escrows any SOL.
   * Any active pool can be specified provided it is a Trade or NFT type.
   */
  pool: Address<TAccountPool>;
  /** The TA of the buyer, where the NFT will be transferred. */
  buyerTa?: Address<TAccountBuyerTa>;
  /** The TA of the pool, where the NFT will be escrowed. */
  poolTa?: Address<TAccountPoolTa>;
  /** The mint account of the NFT. */
  mint: Address<TAccountMint>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  /** The shared escrow account for pools that pool liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /**
   * The optional cosigner account that must be passed in if the pool has a cosigner.
   * Checks are performed in the handler.
   */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  maxAmount: BuyNftT22InstructionDataArgs['maxAmount'];
  creators: Array<Address>;
};

export async function getBuyNftT22InstructionAsync<
  TAccountOwner extends string,
  TAccountBuyer extends string,
  TAccountRentPayer extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountBuyerTa extends string,
  TAccountPoolTa extends string,
  TAccountMint extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
>(
  input: BuyNftT22AsyncInput<
    TAccountOwner,
    TAccountBuyer,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerTa,
    TAccountPoolTa,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram
  >
): Promise<
  BuyNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountBuyer,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerTa,
    TAccountPoolTa,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    buyer: { value: input.buyer ?? null, isWritable: true },
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    buyerTa: { value: input.buyerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
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
  if (!accounts.feeVault.value) {
    accounts.feeVault = {
      ...accounts.feeVault,
      ...(await resolveFeeVaultPdaFromPool(resolverScope)),
    };
  }
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.buyerTa.value) {
    accounts.buyerTa = {
      ...accounts.buyerTa,
      ...(await resolveBuyerAta(resolverScope)),
    };
  }
  if (!accounts.poolTa.value) {
    accounts.poolTa = {
      ...accounts.poolTa,
      ...(await resolvePoolAta(resolverScope)),
    };
  }
  if (!accounts.nftReceipt.value) {
    accounts.nftReceipt = {
      ...accounts.nftReceipt,
      ...(await resolvePoolNftReceipt(resolverScope)),
    };
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;
  }

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = args.creators.map((address) => ({
    address,
    role: AccountRole.WRITABLE,
  }));

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.buyer),
      getAccountMeta(accounts.rentPayer),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.buyerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getBuyNftT22InstructionDataEncoder().encode(
      args as BuyNftT22InstructionDataArgs
    ),
  } as BuyNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountBuyer,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerTa,
    TAccountPoolTa,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram
  >;

  return instruction;
}

export type BuyNftT22Input<
  TAccountOwner extends string = string,
  TAccountBuyer extends string = string,
  TAccountRentPayer extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountBuyerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountMint extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
> = {
  /**
   * Owner is the pool owner who created the pool and the nominal owner of the
   * escrowed NFT. In this transaction they are the seller, though the transfer
   * of the NFT is handled by the pool.
   */
  owner: Address<TAccountOwner>;
  /** Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT. */
  buyer: TransactionSigner<TAccountBuyer>;
  /**
   * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
   * is auto-closed.
   */
  rentPayer?: Address<TAccountRentPayer>;
  /** Fee vault account owned by the TFEE program. */
  feeVault: Address<TAccountFeeVault>;
  /**
   * The Pool state account that holds the NFT to be purchased. Stores pool state and config,
   * but is also the owner of any NFTs in the pool, and also escrows any SOL.
   * Any active pool can be specified provided it is a Trade or NFT type.
   */
  pool: Address<TAccountPool>;
  /** The TA of the buyer, where the NFT will be transferred. */
  buyerTa: Address<TAccountBuyerTa>;
  /** The TA of the pool, where the NFT will be escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The mint account of the NFT. */
  mint: Address<TAccountMint>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  /** The shared escrow account for pools that pool liquidity in a shared account. */
  sharedEscrow?: Address<TAccountSharedEscrow>;
  /** The account that receives the maker broker fee. */
  makerBroker?: Address<TAccountMakerBroker>;
  /** The account that receives the taker broker fee. */
  takerBroker?: Address<TAccountTakerBroker>;
  /**
   * The optional cosigner account that must be passed in if the pool has a cosigner.
   * Checks are performed in the handler.
   */
  cosigner?: TransactionSigner<TAccountCosigner>;
  /** The AMM program account, used for self-cpi logging. */
  ammProgram?: Address<TAccountAmmProgram>;
  maxAmount: BuyNftT22InstructionDataArgs['maxAmount'];
  creators: Array<Address>;
};

export function getBuyNftT22Instruction<
  TAccountOwner extends string,
  TAccountBuyer extends string,
  TAccountRentPayer extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountBuyerTa extends string,
  TAccountPoolTa extends string,
  TAccountMint extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
>(
  input: BuyNftT22Input<
    TAccountOwner,
    TAccountBuyer,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerTa,
    TAccountPoolTa,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram
  >
): BuyNftT22Instruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountBuyer,
  TAccountRentPayer,
  TAccountFeeVault,
  TAccountPool,
  TAccountBuyerTa,
  TAccountPoolTa,
  TAccountMint,
  TAccountNftReceipt,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountSharedEscrow,
  TAccountMakerBroker,
  TAccountTakerBroker,
  TAccountCosigner,
  TAccountAmmProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    buyer: { value: input.buyer ?? null, isWritable: true },
    rentPayer: { value: input.rentPayer ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    buyerTa: { value: input.buyerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    cosigner: { value: input.cosigner ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.rentPayer.value) {
    accounts.rentPayer.value = expectSome(accounts.owner.value);
  }
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }
  if (!accounts.ammProgram.value) {
    accounts.ammProgram.value =
      'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;
  }

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = args.creators.map((address) => ({
    address,
    role: AccountRole.WRITABLE,
  }));

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.buyer),
      getAccountMeta(accounts.rentPayer),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.buyerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getBuyNftT22InstructionDataEncoder().encode(
      args as BuyNftT22InstructionDataArgs
    ),
  } as BuyNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountBuyer,
    TAccountRentPayer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerTa,
    TAccountPoolTa,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram
  >;

  return instruction;
}

export type ParsedBuyNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /**
     * Owner is the pool owner who created the pool and the nominal owner of the
     * escrowed NFT. In this transaction they are the seller, though the transfer
     * of the NFT is handled by the pool.
     */

    owner: TAccountMetas[0];
    /** Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT. */
    buyer: TAccountMetas[1];
    /**
     * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
     * is auto-closed.
     */

    rentPayer: TAccountMetas[2];
    /** Fee vault account owned by the TFEE program. */
    feeVault: TAccountMetas[3];
    /**
     * The Pool state account that holds the NFT to be purchased. Stores pool state and config,
     * but is also the owner of any NFTs in the pool, and also escrows any SOL.
     * Any active pool can be specified provided it is a Trade or NFT type.
     */

    pool: TAccountMetas[4];
    /** The TA of the buyer, where the NFT will be transferred. */
    buyerTa: TAccountMetas[5];
    /** The TA of the pool, where the NFT will be escrowed. */
    poolTa: TAccountMetas[6];
    /** The mint account of the NFT. */
    mint: TAccountMetas[7];
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[8];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[9];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[10];
    /** The Solana system program. */
    systemProgram: TAccountMetas[11];
    /** The shared escrow account for pools that pool liquidity in a shared account. */
    sharedEscrow?: TAccountMetas[12] | undefined;
    /** The account that receives the maker broker fee. */
    makerBroker?: TAccountMetas[13] | undefined;
    /** The account that receives the taker broker fee. */
    takerBroker?: TAccountMetas[14] | undefined;
    /**
     * The optional cosigner account that must be passed in if the pool has a cosigner.
     * Checks are performed in the handler.
     */

    cosigner?: TAccountMetas[15] | undefined;
    /** The AMM program account, used for self-cpi logging. */
    ammProgram: TAccountMetas[16];
  };
  data: BuyNftT22InstructionData;
};

export function parseBuyNftT22Instruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedBuyNftT22Instruction<TProgram, TAccountMetas> {
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
      buyer: getNextAccount(),
      rentPayer: getNextAccount(),
      feeVault: getNextAccount(),
      pool: getNextAccount(),
      buyerTa: getNextAccount(),
      poolTa: getNextAccount(),
      mint: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      sharedEscrow: getNextOptionalAccount(),
      makerBroker: getNextOptionalAccount(),
      takerBroker: getNextOptionalAccount(),
      cosigner: getNextOptionalAccount(),
      ammProgram: getNextAccount(),
    },
    data: getBuyNftT22InstructionDataDecoder().decode(instruction.data),
  };
}
