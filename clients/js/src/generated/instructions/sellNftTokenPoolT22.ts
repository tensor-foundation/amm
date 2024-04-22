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
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  mapEncoder,
} from '@solana/codecs';
import {
  IAccountMeta,
  IInstruction,
  IInstructionWithAccounts,
  IInstructionWithData,
  ReadonlyAccount,
  WritableAccount,
  WritableSignerAccount,
} from '@solana/instructions';
import { IAccountSignerMeta, TransactionSigner } from '@solana/signers';
import { AMM_PROGRAM_ADDRESS } from '../programs';
import { ResolvedAccount, getAccountMetaFactory } from '../shared';
import {
  PoolConfig,
  PoolConfigArgs,
  getPoolConfigDecoder,
  getPoolConfigEncoder,
} from '../types';

export type SellNftTokenPoolT22Instruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountSeller extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountSellerAta extends string | IAccountMeta<string> = string,
  TAccountOwnerAta extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountSharedEscrowAccount extends string | IAccountMeta<string> = string,
  TAccountTakerBroker extends string | IAccountMeta<string> = string,
  TAccountMakerBroker extends string | IAccountMeta<string> = string,
  TAccountAmmProgram extends string | IAccountMeta<string> = string,
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
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountSellerAta extends string
        ? WritableAccount<TAccountSellerAta>
        : TAccountSellerAta,
      TAccountOwnerAta extends string
        ? WritableAccount<TAccountOwnerAta>
        : TAccountOwnerAta,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      TAccountSharedEscrowAccount extends string
        ? WritableAccount<TAccountSharedEscrowAccount>
        : TAccountSharedEscrowAccount,
      TAccountTakerBroker extends string
        ? WritableAccount<TAccountTakerBroker>
        : TAccountTakerBroker,
      TAccountMakerBroker extends string
        ? ReadonlyAccount<TAccountMakerBroker>
        : TAccountMakerBroker,
      TAccountAmmProgram extends string
        ? ReadonlyAccount<TAccountAmmProgram>
        : TAccountAmmProgram,
      ...TRemainingAccounts,
    ]
  >;

export type SellNftTokenPoolT22InstructionData = {
  discriminator: Array<number>;
  config: PoolConfig;
  minPrice: bigint;
};

export type SellNftTokenPoolT22InstructionDataArgs = {
  config: PoolConfigArgs;
  minPrice: number | bigint;
};

export function getSellNftTokenPoolT22InstructionDataEncoder(): Encoder<SellNftTokenPoolT22InstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['config', getPoolConfigEncoder()],
      ['minPrice', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: [149, 234, 31, 103, 26, 36, 166, 49],
    })
  );
}

export function getSellNftTokenPoolT22InstructionDataDecoder(): Decoder<SellNftTokenPoolT22InstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['config', getPoolConfigDecoder()],
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

export type SellNftTokenPoolT22Input<
  TAccountOwner extends string = string,
  TAccountSeller extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountSellerAta extends string = string,
  TAccountOwnerAta extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountSharedEscrowAccount extends string = string,
  TAccountTakerBroker extends string = string,
  TAccountMakerBroker extends string = string,
  TAccountAmmProgram extends string = string,
> = {
  owner: Address<TAccountOwner>;
  seller: TransactionSigner<TAccountSeller>;
  feeVault: Address<TAccountFeeVault>;
  pool: Address<TAccountPool>;
  /** Needed for pool seeds derivation, also checked via has_one on pool */
  whitelist: Address<TAccountWhitelist>;
  mintProof: Address<TAccountMintProof>;
  /** The mint account of the NFT being sold. */
  mint: Address<TAccountMint>;
  /** The ATA of the NFT for the seller's wallet. */
  sellerAta: Address<TAccountSellerAta>;
  /** The ATA of the owner, where the NFT will be transferred to as a result of this sale. */
  ownerAta: Address<TAccountOwnerAta>;
  tokenProgram?: Address<TAccountTokenProgram>;
  associatedTokenProgram: Address<TAccountAssociatedTokenProgram>;
  systemProgram?: Address<TAccountSystemProgram>;
  sharedEscrowAccount: Address<TAccountSharedEscrowAccount>;
  takerBroker: Address<TAccountTakerBroker>;
  makerBroker?: Address<TAccountMakerBroker>;
  ammProgram: Address<TAccountAmmProgram>;
  config: SellNftTokenPoolT22InstructionDataArgs['config'];
  minPrice: SellNftTokenPoolT22InstructionDataArgs['minPrice'];
};

export function getSellNftTokenPoolT22Instruction<
  TAccountOwner extends string,
  TAccountSeller extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountSellerAta extends string,
  TAccountOwnerAta extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountSharedEscrowAccount extends string,
  TAccountTakerBroker extends string,
  TAccountMakerBroker extends string,
  TAccountAmmProgram extends string,
>(
  input: SellNftTokenPoolT22Input<
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerAta,
    TAccountOwnerAta,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrowAccount,
    TAccountTakerBroker,
    TAccountMakerBroker,
    TAccountAmmProgram
  >
): SellNftTokenPoolT22Instruction<
  typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountSeller,
  TAccountFeeVault,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountMint,
  TAccountSellerAta,
  TAccountOwnerAta,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountSharedEscrowAccount,
  TAccountTakerBroker,
  TAccountMakerBroker,
  TAccountAmmProgram
> {
  // Program address.
  const programAddress = AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    seller: { value: input.seller ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    mint: { value: input.mint ?? null, isWritable: false },
    sellerAta: { value: input.sellerAta ?? null, isWritable: true },
    ownerAta: { value: input.ownerAta ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    sharedEscrowAccount: {
      value: input.sharedEscrowAccount ?? null,
      isWritable: true,
    },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
    makerBroker: { value: input.makerBroker ?? null, isWritable: false },
    ammProgram: { value: input.ammProgram ?? null, isWritable: false },
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
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
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
      getAccountMeta(accounts.sellerAta),
      getAccountMeta(accounts.ownerAta),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.sharedEscrowAccount),
      getAccountMeta(accounts.takerBroker),
      getAccountMeta(accounts.makerBroker),
      getAccountMeta(accounts.ammProgram),
    ],
    programAddress,
    data: getSellNftTokenPoolT22InstructionDataEncoder().encode(
      args as SellNftTokenPoolT22InstructionDataArgs
    ),
  } as SellNftTokenPoolT22Instruction<
    typeof AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountSeller,
    TAccountFeeVault,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountSellerAta,
    TAccountOwnerAta,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountSharedEscrowAccount,
    TAccountTakerBroker,
    TAccountMakerBroker,
    TAccountAmmProgram
  >;

  return instruction;
}

export type ParsedSellNftTokenPoolT22Instruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    owner: TAccountMetas[0];
    seller: TAccountMetas[1];
    feeVault: TAccountMetas[2];
    pool: TAccountMetas[3];
    /** Needed for pool seeds derivation, also checked via has_one on pool */
    whitelist: TAccountMetas[4];
    mintProof: TAccountMetas[5];
    /** The mint account of the NFT being sold. */
    mint: TAccountMetas[6];
    /** The ATA of the NFT for the seller's wallet. */
    sellerAta: TAccountMetas[7];
    /** The ATA of the owner, where the NFT will be transferred to as a result of this sale. */
    ownerAta: TAccountMetas[8];
    tokenProgram: TAccountMetas[9];
    associatedTokenProgram: TAccountMetas[10];
    systemProgram: TAccountMetas[11];
    sharedEscrowAccount: TAccountMetas[12];
    takerBroker: TAccountMetas[13];
    makerBroker?: TAccountMetas[14] | undefined;
    ammProgram: TAccountMetas[15];
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
  if (instruction.accounts.length < 16) {
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
    return accountMeta.address === AMM_PROGRAM_ADDRESS
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
      mintProof: getNextAccount(),
      mint: getNextAccount(),
      sellerAta: getNextAccount(),
      ownerAta: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      sharedEscrowAccount: getNextAccount(),
      takerBroker: getNextAccount(),
      makerBroker: getNextOptionalAccount(),
      ammProgram: getNextAccount(),
    },
    data: getSellNftTokenPoolT22InstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
