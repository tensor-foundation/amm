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
  resolvePoolAta,
  resolvePoolNftReceipt,
  resolveSellerAta,
} from '@tensor-foundation/resolvers';
import { resolveFeeVaultPdaFromPool } from '../../hooked';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export type SellNftTradePoolT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSeller extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountSellerTa extends string | IAccountMeta<string> = string,
  TAccountPoolTa extends string | IAccountMeta<string> = string,
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
  TAccountEscrowProgram extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountOwner extends string
        ? ReadonlyAccount<TAccountOwner>
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
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountSellerTa extends string
        ? WritableAccount<TAccountSellerTa>
        : TAccountSellerTa,
      TAccountPoolTa extends string
        ? WritableAccount<TAccountPoolTa>
        : TAccountPoolTa,
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
      TAccountEscrowProgram extends string
        ? ReadonlyAccount<TAccountEscrowProgram>
        : TAccountEscrowProgram,
      ...TRemainingAccounts,
    ]
  >;

export type SellNftTradePoolT22InstructionData = {
  discriminator: ReadonlyUint8Array;
  minPrice: bigint;
};

export type SellNftTradePoolT22InstructionDataArgs = {
  minPrice: number | bigint;
};

export function getSellNftTradePoolT22InstructionDataEncoder(): Encoder<SellNftTradePoolT22InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['minPrice', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([124, 145, 23, 52, 72, 113, 85, 9]),
    })
  );
}

export function getSellNftTradePoolT22InstructionDataDecoder(): Decoder<SellNftTradePoolT22InstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['minPrice', getU64Decoder()],
  ]);
}

export function getSellNftTradePoolT22InstructionDataCodec(): Codec<
  SellNftTradePoolT22InstructionDataArgs,
  SellNftTradePoolT22InstructionData
> {
  return combineCodec(
    getSellNftTradePoolT22InstructionDataEncoder(),
    getSellNftTradePoolT22InstructionDataDecoder()
  );
}

export type SellNftTradePoolT22AsyncInput<
  TAccountOwner extends string = string,
  TAccountSeller extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountSellerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
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
  /** The mint account of the NFT being sold. */
  mint: Address<TAccountMint>;
  /** The token account of the seller, where the NFT will be transferred from. */
  sellerTa?: Address<TAccountSellerTa>;
  /** The TA of the pool, where the NFT will be transferred to. */
  poolTa?: Address<TAccountPoolTa>;
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
  escrowProgram?: Address<TAccountEscrowProgram>;
  minPrice: SellNftTradePoolT22InstructionDataArgs['minPrice'];
};

export async function getSellNftTradePoolT22InstructionAsync<
  TAccountOwner extends string,
  TAccountSeller extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountSellerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
>(
  input: SellNftTradePoolT22AsyncInput<
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram
  >
): Promise<
  SellNftTradePoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: false },
    seller: { value: input.seller ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    mint: { value: input.mint ?? null, isWritable: false },
    sellerTa: { value: input.sellerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
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
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
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
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.sellerTa.value) {
    accounts.sellerTa = {
      ...accounts.sellerTa,
      ...(await resolveSellerAta(resolverScope)),
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.seller),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.sellerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
    ],
    programAddress,
    data: getSellNftTradePoolT22InstructionDataEncoder().encode(
      args as SellNftTradePoolT22InstructionDataArgs
    ),
  } as SellNftTradePoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram
  >;

  return instruction;
}

export type SellNftTradePoolT22Input<
  TAccountOwner extends string = string,
  TAccountSeller extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountSellerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountCosigner extends string = string,
  TAccountAmmProgram extends string = string,
  TAccountEscrowProgram extends string = string,
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
  /** The mint account of the NFT being sold. */
  mint: Address<TAccountMint>;
  /** The token account of the seller, where the NFT will be transferred from. */
  sellerTa: Address<TAccountSellerTa>;
  /** The TA of the pool, where the NFT will be transferred to. */
  poolTa: Address<TAccountPoolTa>;
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
  escrowProgram?: Address<TAccountEscrowProgram>;
  minPrice: SellNftTradePoolT22InstructionDataArgs['minPrice'];
};

export function getSellNftTradePoolT22Instruction<
  TAccountOwner extends string,
  TAccountSeller extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountSellerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountSharedEscrow extends string,
  TAccountMakerBroker extends string,
  TAccountTakerBroker extends string,
  TAccountCosigner extends string,
  TAccountAmmProgram extends string,
  TAccountEscrowProgram extends string,
>(
  input: SellNftTradePoolT22Input<
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram
  >
): SellNftTradePoolT22Instruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountSeller,
  TAccountFeeVault,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountMint,
  TAccountSellerTa,
  TAccountPoolTa,
  TAccountNftReceipt,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountSharedEscrow,
  TAccountMakerBroker,
  TAccountTakerBroker,
  TAccountCosigner,
  TAccountAmmProgram,
  TAccountEscrowProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: false },
    seller: { value: input.seller ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    mint: { value: input.mint ?? null, isWritable: false },
    sellerTa: { value: input.sellerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
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
    escrowProgram: { value: input.escrowProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.seller),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.sellerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.cosigner),
      getAccountMeta(accounts.ammProgram),
      getAccountMeta(accounts.escrowProgram),
    ],
    programAddress,
    data: getSellNftTradePoolT22InstructionDataEncoder().encode(
      args as SellNftTradePoolT22InstructionDataArgs
    ),
  } as SellNftTradePoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrow,
    TAccountMakerBroker,
    TAccountTakerBroker,
    TAccountCosigner,
    TAccountAmmProgram,
    TAccountEscrowProgram
  >;

  return instruction;
}

export type ParsedSellNftTradePoolT22Instruction<
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
    /** The mint account of the NFT being sold. */
    mint: TAccountMetas[6];
    /** The token account of the seller, where the NFT will be transferred from. */
    sellerTa: TAccountMetas[7];
    /** The TA of the pool, where the NFT will be transferred to. */
    poolTa: TAccountMetas[8];
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[9];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[10];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[11];
    /** The Solana system program. */
    systemProgram: TAccountMetas[12];
    /** The shared escrow account for pools that pool liquidity in a shared account. */
    sharedEscrow?: TAccountMetas[13] | undefined;
    /** The account that receives the maker broker fee. */
    makerBroker?: TAccountMetas[14] | undefined;
    /** The account that receives the taker broker fee. */
    takerBroker?: TAccountMetas[15] | undefined;
    /**
     * The optional cosigner account that must be passed in if the pool has a cosigner.
     * Checks are performed in the handler.
     */

    cosigner?: TAccountMetas[16] | undefined;
    /** The AMM program account, used for self-cpi logging. */
    ammProgram: TAccountMetas[17];
    escrowProgram?: TAccountMetas[18] | undefined;
  };
  data: SellNftTradePoolT22InstructionData;
};

export function parseSellNftTradePoolT22Instruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedSellNftTradePoolT22Instruction<TProgram, TAccountMetas> {
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
      owner: getNextAccount(),
      seller: getNextAccount(),
      feeVault: getNextAccount(),
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      mintProof: getNextOptionalAccount(),
      mint: getNextAccount(),
      sellerTa: getNextAccount(),
      poolTa: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      sharedEscrow: getNextOptionalAccount(),
      makerBroker: getNextOptionalAccount(),
      takerBroker: getNextOptionalAccount(),
      cosigner: getNextOptionalAccount(),
      ammProgram: getNextAccount(),
      escrowProgram: getNextOptionalAccount(),
    },
    data: getSellNftTradePoolT22InstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
