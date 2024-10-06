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
import { resolveOwnerAta } from '@tensor-foundation/resolvers';
import { resolveFeeVaultPdaFromPool, resolveTakerAta } from '../../hooked';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export type SellNftTokenPoolT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountSysProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
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
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountTakerTa extends string | IAccountMeta<string> = string,
  TAccountOwnerTa extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  TAccountAssociatedTokenProgram extends
    | string
    | IAccountMeta<string> = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSysProgram extends string
        ? ReadonlyAccount<TAccountSysProgram>
        : TAccountSysProgram,
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
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountTakerTa extends string
        ? WritableAccount<TAccountTakerTa>
        : TAccountTakerTa,
      TAccountOwnerTa extends string
        ? WritableAccount<TAccountOwnerTa>
        : TAccountOwnerTa,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type SellNftTokenPoolT22InstructionData = {
  discriminator: ReadonlyUint8Array;
  minPrice: bigint;
};

export type SellNftTokenPoolT22InstructionDataArgs = {
  minPrice: number | bigint;
};

export function getSellNftTokenPoolT22InstructionDataEncoder(): Encoder<SellNftTokenPoolT22InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['minPrice', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([149, 234, 31, 103, 26, 36, 166, 49]),
    })
  );
}

export function getSellNftTokenPoolT22InstructionDataDecoder(): Decoder<SellNftTokenPoolT22InstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['minPrice', getU64Decoder()],
  ]);
}

export function getSellNftTokenPoolT22InstructionDataCodec(): Codec<
  SellNftTokenPoolT22InstructionDataArgs,
  SellNftTokenPoolT22InstructionData
> {
  return combineCodec(
    getSellNftTokenPoolT22InstructionDataEncoder(),
    getSellNftTokenPoolT22InstructionDataDecoder()
  );
}

export type SellNftTokenPoolT22AsyncInput<
  TAccountSysProgram extends string = string,
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
  TAccountMint extends string = string,
  TAccountTakerTa extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  sysProgram?: Address<TAccountSysProgram>;
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
  /** The mint account of the NFT being sold. */
  mint: Address<TAccountMint>;
  /** The token account of the NFT for the seller's wallet. */
  takerTa?: Address<TAccountTakerTa>;
  /** The ATA of the owner, where the NFT will be transferred to as a result of this sale. */
  ownerTa?: Address<TAccountOwnerTa>;
  /** The Token 2022 program. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTokenPoolT22InstructionDataArgs['minPrice'];
  creators?: Array<Address>;
  transferHookAccounts: Array<Address>;
};

export async function getSellNftTokenPoolT22InstructionAsync<
  TAccountSysProgram extends string,
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
  TAccountMint extends string,
  TAccountTakerTa extends string,
  TAccountOwnerTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTokenPoolT22AsyncInput<
    TAccountSysProgram,
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
    TAccountMint,
    TAccountTakerTa,
    TAccountOwnerTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): Promise<
  SellNftTokenPoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountSysProgram,
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
    TAccountMint,
    TAccountTakerTa,
    TAccountOwnerTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    sysProgram: { value: input.sysProgram ?? null, isWritable: false },
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
    mint: { value: input.mint ?? null, isWritable: false },
    takerTa: { value: input.takerTa ?? null, isWritable: true },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
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
  if (!accounts.sysProgram.value) {
    accounts.sysProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
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
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address<'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'>;
  }
  if (!accounts.takerTa.value) {
    accounts.takerTa = {
      ...accounts.takerTa,
      ...(await resolveTakerAta(resolverScope)),
    };
  }
  if (!accounts.ownerTa.value) {
    accounts.ownerTa = {
      ...accounts.ownerTa,
      ...(await resolveOwnerAta(resolverScope)),
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

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = [
    ...(args.creators ?? []).map((address) => ({
      address,
      role: AccountRole.WRITABLE,
    })),
    ...args.transferHookAccounts.map((address) => ({
      address,
      role: AccountRole.READONLY,
    })),
  ];

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.sysProgram),
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
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.takerTa),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTokenPoolT22InstructionDataEncoder().encode(
      args as SellNftTokenPoolT22InstructionDataArgs
    ),
  } as SellNftTokenPoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountSysProgram,
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
    TAccountMint,
    TAccountTakerTa,
    TAccountOwnerTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type SellNftTokenPoolT22Input<
  TAccountSysProgram extends string = string,
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
  TAccountMint extends string = string,
  TAccountTakerTa extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  sysProgram?: Address<TAccountSysProgram>;
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
  /** The mint account of the NFT being sold. */
  mint: Address<TAccountMint>;
  /** The token account of the NFT for the seller's wallet. */
  takerTa: Address<TAccountTakerTa>;
  /** The ATA of the owner, where the NFT will be transferred to as a result of this sale. */
  ownerTa: Address<TAccountOwnerTa>;
  /** The Token 2022 program. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  minPrice: SellNftTokenPoolT22InstructionDataArgs['minPrice'];
  creators?: Array<Address>;
  transferHookAccounts: Array<Address>;
};

export function getSellNftTokenPoolT22Instruction<
  TAccountSysProgram extends string,
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
  TAccountMint extends string,
  TAccountTakerTa extends string,
  TAccountOwnerTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: SellNftTokenPoolT22Input<
    TAccountSysProgram,
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
    TAccountMint,
    TAccountTakerTa,
    TAccountOwnerTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): SellNftTokenPoolT22Instruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountSysProgram,
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
  TAccountMint,
  TAccountTakerTa,
  TAccountOwnerTa,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    sysProgram: { value: input.sysProgram ?? null, isWritable: false },
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
    mint: { value: input.mint ?? null, isWritable: false },
    takerTa: { value: input.takerTa ?? null, isWritable: true },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.sysProgram.value) {
    accounts.sysProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
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
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address<'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'>;
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = [
    ...(args.creators ?? []).map((address) => ({
      address,
      role: AccountRole.WRITABLE,
    })),
    ...args.transferHookAccounts.map((address) => ({
      address,
      role: AccountRole.READONLY,
    })),
  ];

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.sysProgram),
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
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.takerTa),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      ...remainingAccounts,
    ],
    programAddress,
    data: getSellNftTokenPoolT22InstructionDataEncoder().encode(
      args as SellNftTokenPoolT22InstructionDataArgs
    ),
  } as SellNftTokenPoolT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountSysProgram,
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
    TAccountMint,
    TAccountTakerTa,
    TAccountOwnerTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedSellNftTokenPoolT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    sysProgram: TAccountMetas[0];
    /** The owner of the pool and the buyer/recipient of the NFT. */
    owner: TAccountMetas[1];
    /** The taker is the user buying or selling the NFT. */
    taker: TAccountMetas[2];
    /**
     * The original rent payer of the pool--stored on the pool. Used to refund rent in case the pool
     * is auto-closed.
     */

    rentPayer: TAccountMetas[3];
    /** Fee vault account owned by the TFEE program. */
    feeVault: TAccountMetas[4];
    /**
     * The Pool state account that the NFT is being sold into. Stores pool state and config,
     * but is also the owner of any NFTs in the pool, and also escrows any SOL.
     * Any active pool can be specified provided it is a Token type and the NFT passes at least one
     * whitelist condition.
     */

    pool: TAccountMetas[5];
    /** The whitelist account that the pool uses to verify the NFTs being sold into it. */
    whitelist: TAccountMetas[6];
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[7] | undefined;
    /** The shared escrow account for pools that have liquidity in a shared account. */
    sharedEscrow?: TAccountMetas[8] | undefined;
    /** The account that receives the maker broker fee. */
    makerBroker?: TAccountMetas[9] | undefined;
    /** The account that receives the taker broker fee. */
    takerBroker?: TAccountMetas[10] | undefined;
    /** The optional cosigner account that must be passed in if the pool has a cosigner. */
    cosigner?: TAccountMetas[11] | undefined;
    /** The AMM program account, used for self-cpi logging. */
    ammProgram: TAccountMetas[12];
    /** The escrow program account for shared liquidity pools. */
    escrowProgram?: TAccountMetas[13] | undefined;
    nativeProgram: TAccountMetas[14];
    /** The mint account of the NFT being sold. */
    mint: TAccountMetas[15];
    /** The token account of the NFT for the seller's wallet. */
    takerTa: TAccountMetas[16];
    /** The ATA of the owner, where the NFT will be transferred to as a result of this sale. */
    ownerTa: TAccountMetas[17];
    /** The Token 2022 program. */
    tokenProgram: TAccountMetas[18];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[19];
    /** The Solana system program. */
    systemProgram: TAccountMetas[20];
  };
  data: SellNftTokenPoolT22InstructionData;
};

export function parseSellNftTokenPoolT22Instruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedSellNftTokenPoolT22Instruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 21) {
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
      sysProgram: getNextAccount(),
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
      mint: getNextAccount(),
      takerTa: getNextAccount(),
      ownerTa: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getSellNftTokenPoolT22InstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
