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
  Option,
  OptionOrNullable,
  combineCodec,
  getArrayDecoder,
  getArrayEncoder,
  getBooleanDecoder,
  getBooleanEncoder,
  getOptionDecoder,
  getOptionEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
  mapEncoder,
} from '@solana/codecs';
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
import { IAccountSignerMeta, TransactionSigner } from '@solana/signers';
import { AMM_PROGRAM_ADDRESS } from '../programs';
import { ResolvedAccount, getAccountMetaFactory } from '../shared';
import {
  AuthorizationDataLocal,
  AuthorizationDataLocalArgs,
  getAuthorizationDataLocalDecoder,
  getAuthorizationDataLocalEncoder,
} from '../types';

export type BuyNftInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountBuyer extends string | IAccountMeta<string> = string,
  TAccountFeeVault extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountBuyerAta extends string | IAccountMeta<string> = string,
  TAccountPoolAta extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountMetadata extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountRent extends
    | string
    | IAccountMeta<string> = 'SysvarRent111111111111111111111111111111111',
  TAccountEdition extends string | IAccountMeta<string> = string,
  TAccountPoolTokenRecord extends string | IAccountMeta<string> = string,
  TAccountBuyerTokenRecord extends string | IAccountMeta<string> = string,
  TAccountTokenMetadataProgram extends
    | string
    | IAccountMeta<string> = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  TAccountInstructions extends string | IAccountMeta<string> = string,
  TAccountAuthorizationRulesProgram extends
    | string
    | IAccountMeta<string> = 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
  TAccountAuthRules extends string | IAccountMeta<string> = string,
  TAccountSharedEscrow extends string | IAccountMeta<string> = string,
  TAccountTakerBroker extends string | IAccountMeta<string> = string,
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
      TAccountFeeVault extends string
        ? WritableAccount<TAccountFeeVault>
        : TAccountFeeVault,
      TAccountPool extends string
        ? WritableAccount<TAccountPool>
        : TAccountPool,
      TAccountBuyerAta extends string
        ? WritableAccount<TAccountBuyerAta>
        : TAccountBuyerAta,
      TAccountPoolAta extends string
        ? WritableAccount<TAccountPoolAta>
        : TAccountPoolAta,
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountMetadata extends string
        ? WritableAccount<TAccountMetadata>
        : TAccountMetadata,
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
      TAccountRent extends string
        ? ReadonlyAccount<TAccountRent>
        : TAccountRent,
      TAccountEdition extends string
        ? ReadonlyAccount<TAccountEdition>
        : TAccountEdition,
      TAccountPoolTokenRecord extends string
        ? WritableAccount<TAccountPoolTokenRecord>
        : TAccountPoolTokenRecord,
      TAccountBuyerTokenRecord extends string
        ? WritableAccount<TAccountBuyerTokenRecord>
        : TAccountBuyerTokenRecord,
      TAccountTokenMetadataProgram extends string
        ? ReadonlyAccount<TAccountTokenMetadataProgram>
        : TAccountTokenMetadataProgram,
      TAccountInstructions extends string
        ? ReadonlyAccount<TAccountInstructions>
        : TAccountInstructions,
      TAccountAuthorizationRulesProgram extends string
        ? ReadonlyAccount<TAccountAuthorizationRulesProgram>
        : TAccountAuthorizationRulesProgram,
      TAccountAuthRules extends string
        ? ReadonlyAccount<TAccountAuthRules>
        : TAccountAuthRules,
      TAccountSharedEscrow extends string
        ? WritableAccount<TAccountSharedEscrow>
        : TAccountSharedEscrow,
      TAccountTakerBroker extends string
        ? WritableAccount<TAccountTakerBroker>
        : TAccountTakerBroker,
      ...TRemainingAccounts,
    ]
  >;

export type BuyNftInstructionData = {
  discriminator: Array<number>;
  maxPrice: bigint;
  rulesAccPresent: boolean;
  authorizationData: Option<AuthorizationDataLocal>;
  optionalRoyaltyPct: Option<number>;
};

export type BuyNftInstructionDataArgs = {
  maxPrice: number | bigint;
  rulesAccPresent: boolean;
  authorizationData: OptionOrNullable<AuthorizationDataLocalArgs>;
  optionalRoyaltyPct: OptionOrNullable<number>;
};

export function getBuyNftInstructionDataEncoder(): Encoder<BuyNftInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['maxPrice', getU64Encoder()],
      ['rulesAccPresent', getBooleanEncoder()],
      [
        'authorizationData',
        getOptionEncoder(getAuthorizationDataLocalEncoder()),
      ],
      ['optionalRoyaltyPct', getOptionEncoder(getU16Encoder())],
    ]),
    (value) => ({ ...value, discriminator: [96, 0, 28, 190, 49, 107, 83, 222] })
  );
}

export function getBuyNftInstructionDataDecoder(): Decoder<BuyNftInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['maxPrice', getU64Decoder()],
    ['rulesAccPresent', getBooleanDecoder()],
    ['authorizationData', getOptionDecoder(getAuthorizationDataLocalDecoder())],
    ['optionalRoyaltyPct', getOptionDecoder(getU16Decoder())],
  ]);
}

export function getBuyNftInstructionDataCodec(): Codec<
  BuyNftInstructionDataArgs,
  BuyNftInstructionData
> {
  return combineCodec(
    getBuyNftInstructionDataEncoder(),
    getBuyNftInstructionDataDecoder()
  );
}

export type BuyNftInput<
  TAccountOwner extends string = string,
  TAccountBuyer extends string = string,
  TAccountFeeVault extends string = string,
  TAccountPool extends string = string,
  TAccountBuyerAta extends string = string,
  TAccountPoolAta extends string = string,
  TAccountMint extends string = string,
  TAccountMetadata extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountRent extends string = string,
  TAccountEdition extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountBuyerTokenRecord extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountInstructions extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountAuthRules extends string = string,
  TAccountSharedEscrow extends string = string,
  TAccountTakerBroker extends string = string,
> = {
  /**
   * Owner is the pool owner who created the pool and the nominal owner of the
   * escrowed NFT. In this transaction they are the seller, though the transfer
   * of the NFT is handled by the pool.
   */
  owner: Address<TAccountOwner>;
  /** Buyer is the external signer who sends SOL to the pool to purchase the escrowed NFT. */
  buyer: TransactionSigner<TAccountBuyer>;
  feeVault: Address<TAccountFeeVault>;
  pool: Address<TAccountPool>;
  /** The ATA of the buyer, where the NFT will be transferred. */
  buyerAta: Address<TAccountBuyerAta>;
  /** The ATA of the pool, where the NFT is held. */
  poolAta: Address<TAccountPoolAta>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ata, pool_ata and the mint stored in the nft receipt.
   */
  mint: Address<TAccountMint>;
  /** The Token Metadata metadata account of the NFT. */
  metadata: Address<TAccountMetadata>;
  /** The NFT deposit receipt account, which tracks an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  tokenProgram?: Address<TAccountTokenProgram>;
  associatedTokenProgram: Address<TAccountAssociatedTokenProgram>;
  systemProgram?: Address<TAccountSystemProgram>;
  rent?: Address<TAccountRent>;
  edition: Address<TAccountEdition>;
  /** The Token Metadata token record for the pool. */
  poolTokenRecord: Address<TAccountPoolTokenRecord>;
  /** The Token Metadata token record for the buyer. */
  buyerTokenRecord: Address<TAccountBuyerTokenRecord>;
  /** The Token Metadata program account. */
  tokenMetadataProgram?: Address<TAccountTokenMetadataProgram>;
  /** The sysvar instructions account. */
  instructions: Address<TAccountInstructions>;
  /** The Metaplex Token Authority Rules program account. */
  authorizationRulesProgram?: Address<TAccountAuthorizationRulesProgram>;
  /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
  authRules: Address<TAccountAuthRules>;
  /** The shared escrow account for pools that pool liquidity in a shared account. */
  sharedEscrow: Address<TAccountSharedEscrow>;
  /**
   * The taker broker account that receives the taker fees.
   * TODO: optional account? what checks?
   */
  takerBroker: Address<TAccountTakerBroker>;
  maxPrice: BuyNftInstructionDataArgs['maxPrice'];
  rulesAccPresent: BuyNftInstructionDataArgs['rulesAccPresent'];
  authorizationData: BuyNftInstructionDataArgs['authorizationData'];
  optionalRoyaltyPct: BuyNftInstructionDataArgs['optionalRoyaltyPct'];
  creators?: Array<Address>;
};

export function getBuyNftInstruction<
  TAccountOwner extends string,
  TAccountBuyer extends string,
  TAccountFeeVault extends string,
  TAccountPool extends string,
  TAccountBuyerAta extends string,
  TAccountPoolAta extends string,
  TAccountMint extends string,
  TAccountMetadata extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountRent extends string,
  TAccountEdition extends string,
  TAccountPoolTokenRecord extends string,
  TAccountBuyerTokenRecord extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountInstructions extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountAuthRules extends string,
  TAccountSharedEscrow extends string,
  TAccountTakerBroker extends string,
>(
  input: BuyNftInput<
    TAccountOwner,
    TAccountBuyer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerAta,
    TAccountPoolAta,
    TAccountMint,
    TAccountMetadata,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountRent,
    TAccountEdition,
    TAccountPoolTokenRecord,
    TAccountBuyerTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountInstructions,
    TAccountAuthorizationRulesProgram,
    TAccountAuthRules,
    TAccountSharedEscrow,
    TAccountTakerBroker
  >
): BuyNftInstruction<
  typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountBuyer,
  TAccountFeeVault,
  TAccountPool,
  TAccountBuyerAta,
  TAccountPoolAta,
  TAccountMint,
  TAccountMetadata,
  TAccountNftReceipt,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountRent,
  TAccountEdition,
  TAccountPoolTokenRecord,
  TAccountBuyerTokenRecord,
  TAccountTokenMetadataProgram,
  TAccountInstructions,
  TAccountAuthorizationRulesProgram,
  TAccountAuthRules,
  TAccountSharedEscrow,
  TAccountTakerBroker
> {
  // Program address.
  const programAddress = AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    buyer: { value: input.buyer ?? null, isWritable: true },
    feeVault: { value: input.feeVault ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    buyerAta: { value: input.buyerAta ?? null, isWritable: true },
    poolAta: { value: input.poolAta ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    metadata: { value: input.metadata ?? null, isWritable: true },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    rent: { value: input.rent ?? null, isWritable: false },
    edition: { value: input.edition ?? null, isWritable: false },
    poolTokenRecord: { value: input.poolTokenRecord ?? null, isWritable: true },
    buyerTokenRecord: {
      value: input.buyerTokenRecord ?? null,
      isWritable: true,
    },
    tokenMetadataProgram: {
      value: input.tokenMetadataProgram ?? null,
      isWritable: false,
    },
    instructions: { value: input.instructions ?? null, isWritable: false },
    authorizationRulesProgram: {
      value: input.authorizationRulesProgram ?? null,
      isWritable: false,
    },
    authRules: { value: input.authRules ?? null, isWritable: false },
    sharedEscrow: { value: input.sharedEscrow ?? null, isWritable: true },
    takerBroker: { value: input.takerBroker ?? null, isWritable: true },
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
  if (!accounts.rent.value) {
    accounts.rent.value =
      'SysvarRent111111111111111111111111111111111' as Address<'SysvarRent111111111111111111111111111111111'>;
  }
  if (!accounts.tokenMetadataProgram.value) {
    accounts.tokenMetadataProgram.value =
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' as Address<'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'>;
  }
  if (!accounts.authorizationRulesProgram.value) {
    accounts.authorizationRulesProgram.value =
      'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg' as Address<'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg'>;
  }

  // Remaining accounts.
  const remainingAccounts: IAccountMeta[] = (args.creators ?? []).map(
    (address) => ({ address, role: AccountRole.WRITABLE })
  );

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.buyer),
      getAccountMeta(accounts.feeVault),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.buyerAta),
      getAccountMeta(accounts.poolAta),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.rent),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.buyerTokenRecord),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.instructions),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.authRules),
      getAccountMeta(accounts.sharedEscrow),
      getAccountMeta(accounts.takerBroker),
      ...remainingAccounts,
    ],
    programAddress,
    data: getBuyNftInstructionDataEncoder().encode(
      args as BuyNftInstructionDataArgs
    ),
  } as BuyNftInstruction<
    typeof AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountBuyer,
    TAccountFeeVault,
    TAccountPool,
    TAccountBuyerAta,
    TAccountPoolAta,
    TAccountMint,
    TAccountMetadata,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountRent,
    TAccountEdition,
    TAccountPoolTokenRecord,
    TAccountBuyerTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountInstructions,
    TAccountAuthorizationRulesProgram,
    TAccountAuthRules,
    TAccountSharedEscrow,
    TAccountTakerBroker
  >;

  return instruction;
}

export type ParsedBuyNftInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
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
    feeVault: TAccountMetas[2];
    pool: TAccountMetas[3];
    /** The ATA of the buyer, where the NFT will be transferred. */
    buyerAta: TAccountMetas[4];
    /** The ATA of the pool, where the NFT is held. */
    poolAta: TAccountMetas[5];
    /**
     * The mint account of the NFT. It should be the mint account common
     * to the owner_ata, pool_ata and the mint stored in the nft receipt.
     */

    mint: TAccountMetas[6];
    /** The Token Metadata metadata account of the NFT. */
    metadata: TAccountMetas[7];
    /** The NFT deposit receipt account, which tracks an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[8];
    tokenProgram: TAccountMetas[9];
    associatedTokenProgram: TAccountMetas[10];
    systemProgram: TAccountMetas[11];
    rent: TAccountMetas[12];
    edition: TAccountMetas[13];
    /** The Token Metadata token record for the pool. */
    poolTokenRecord: TAccountMetas[14];
    /** The Token Metadata token record for the buyer. */
    buyerTokenRecord: TAccountMetas[15];
    /** The Token Metadata program account. */
    tokenMetadataProgram: TAccountMetas[16];
    /** The sysvar instructions account. */
    instructions: TAccountMetas[17];
    /** The Metaplex Token Authority Rules program account. */
    authorizationRulesProgram: TAccountMetas[18];
    /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
    authRules: TAccountMetas[19];
    /** The shared escrow account for pools that pool liquidity in a shared account. */
    sharedEscrow: TAccountMetas[20];
    /**
     * The taker broker account that receives the taker fees.
     * TODO: optional account? what checks?
     */

    takerBroker: TAccountMetas[21];
  };
  data: BuyNftInstructionData;
};

export function parseBuyNftInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedBuyNftInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 22) {
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
      owner: getNextAccount(),
      buyer: getNextAccount(),
      feeVault: getNextAccount(),
      pool: getNextAccount(),
      buyerAta: getNextAccount(),
      poolAta: getNextAccount(),
      mint: getNextAccount(),
      metadata: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      rent: getNextAccount(),
      edition: getNextAccount(),
      poolTokenRecord: getNextAccount(),
      buyerTokenRecord: getNextAccount(),
      tokenMetadataProgram: getNextAccount(),
      instructions: getNextAccount(),
      authorizationRulesProgram: getNextAccount(),
      authRules: getNextAccount(),
      sharedEscrow: getNextAccount(),
      takerBroker: getNextAccount(),
    },
    data: getBuyNftInstructionDataDecoder().decode(instruction.data),
  };
}
