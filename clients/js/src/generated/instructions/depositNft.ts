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
  getOptionDecoder,
  getOptionEncoder,
  getStructDecoder,
  getStructEncoder,
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
  AuthorizationDataLocal,
  AuthorizationDataLocalArgs,
  getAuthorizationDataLocalDecoder,
  getAuthorizationDataLocalEncoder,
} from '../types';

export type DepositNftInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountOwnerAta extends string | IAccountMeta<string> = string,
  TAccountPoolAta extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountRent extends
    | string
    | IAccountMeta<string> = 'SysvarRent111111111111111111111111111111111',
  TAccountMetadata extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountEdition extends string | IAccountMeta<string> = string,
  TAccountOwnerTokenRecord extends string | IAccountMeta<string> = string,
  TAccountPoolTokenRecord extends string | IAccountMeta<string> = string,
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountTokenMetadataProgram extends
    | string
    | IAccountMeta<string> = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  TAccountInstructions extends string | IAccountMeta<string> = string,
  TAccountAuthorizationRulesProgram extends
    | string
    | IAccountMeta<string> = 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
  TAccountAuthRules extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
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
      TAccountOwnerAta extends string
        ? WritableAccount<TAccountOwnerAta>
        : TAccountOwnerAta,
      TAccountPoolAta extends string
        ? WritableAccount<TAccountPoolAta>
        : TAccountPoolAta,
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      TAccountRent extends string
        ? ReadonlyAccount<TAccountRent>
        : TAccountRent,
      TAccountMetadata extends string
        ? ReadonlyAccount<TAccountMetadata>
        : TAccountMetadata,
      TAccountMintProof extends string
        ? ReadonlyAccount<TAccountMintProof>
        : TAccountMintProof,
      TAccountEdition extends string
        ? ReadonlyAccount<TAccountEdition>
        : TAccountEdition,
      TAccountOwnerTokenRecord extends string
        ? ReadonlyAccount<TAccountOwnerTokenRecord>
        : TAccountOwnerTokenRecord,
      TAccountPoolTokenRecord extends string
        ? WritableAccount<TAccountPoolTokenRecord>
        : TAccountPoolTokenRecord,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
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
      ...TRemainingAccounts,
    ]
  >;

export type DepositNftInstructionData = {
  discriminator: Array<number>;
  authorizationData: Option<AuthorizationDataLocal>;
};

export type DepositNftInstructionDataArgs = {
  authorizationData: OptionOrNullable<AuthorizationDataLocalArgs>;
};

export function getDepositNftInstructionDataEncoder(): Encoder<DepositNftInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      [
        'authorizationData',
        getOptionEncoder(getAuthorizationDataLocalEncoder()),
      ],
    ]),
    (value) => ({
      ...value,
      discriminator: [93, 226, 132, 166, 141, 9, 48, 101],
    })
  );
}

export function getDepositNftInstructionDataDecoder(): Decoder<DepositNftInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['authorizationData', getOptionDecoder(getAuthorizationDataLocalDecoder())],
  ]);
}

export function getDepositNftInstructionDataCodec(): Codec<
  DepositNftInstructionDataArgs,
  DepositNftInstructionData
> {
  return combineCodec(
    getDepositNftInstructionDataEncoder(),
    getDepositNftInstructionDataDecoder()
  );
}

export type DepositNftInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountOwnerAta extends string = string,
  TAccountPoolAta extends string = string,
  TAccountMint extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountRent extends string = string,
  TAccountMetadata extends string = string,
  TAccountMintProof extends string = string,
  TAccountEdition extends string = string,
  TAccountOwnerTokenRecord extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountInstructions extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountAuthRules extends string = string,
> = {
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be deposited into the pool. */
  whitelist: Address<TAccountWhitelist>;
  /** The ATA of the owner, where the NFT will be transferred from. */
  ownerAta: Address<TAccountOwnerAta>;
  /** The ATA of the pool, where the NFT will be escrowed. */
  poolAta: Address<TAccountPoolAta>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ata and pool_ata.
   */
  mint: Address<TAccountMint>;
  /** The NFT receipt account denoting that an NFT has been deposited into a pool. */
  nftReceipt: Address<TAccountNftReceipt>;
  tokenProgram?: Address<TAccountTokenProgram>;
  systemProgram?: Address<TAccountSystemProgram>;
  rent?: Address<TAccountRent>;
  /** The Token Metadata metadata account of the NFT. */
  metadata: Address<TAccountMetadata>;
  /**
   * TODO: we can actually deserialize here with a MintProofV2 type
   * but may not be worth it since assert_decode_mint_proof checks
   * seeds, mint, whitelist, and key
   */
  mintProof?: Address<TAccountMintProof>;
  /** The Token Metadata edition account of the NFT. */
  edition: Address<TAccountEdition>;
  /** The Token Metadata owner/buyer token record account of the NFT. */
  ownerTokenRecord: Address<TAccountOwnerTokenRecord>;
  /** The Token Metadata pool token record account of the NFT. */
  poolTokenRecord: Address<TAccountPoolTokenRecord>;
  associatedTokenProgram: Address<TAccountAssociatedTokenProgram>;
  /** The Token Metadata program account. */
  tokenMetadataProgram?: Address<TAccountTokenMetadataProgram>;
  /** The sysvar instructions account. */
  instructions: Address<TAccountInstructions>;
  /** The Metaplex Token Authority Rules program account. */
  authorizationRulesProgram?: Address<TAccountAuthorizationRulesProgram>;
  /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
  authRules: Address<TAccountAuthRules>;
  authorizationData: DepositNftInstructionDataArgs['authorizationData'];
};

export function getDepositNftInstruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountOwnerAta extends string,
  TAccountPoolAta extends string,
  TAccountMint extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountRent extends string,
  TAccountMetadata extends string,
  TAccountMintProof extends string,
  TAccountEdition extends string,
  TAccountOwnerTokenRecord extends string,
  TAccountPoolTokenRecord extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountInstructions extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountAuthRules extends string,
>(
  input: DepositNftInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountOwnerAta,
    TAccountPoolAta,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountSystemProgram,
    TAccountRent,
    TAccountMetadata,
    TAccountMintProof,
    TAccountEdition,
    TAccountOwnerTokenRecord,
    TAccountPoolTokenRecord,
    TAccountAssociatedTokenProgram,
    TAccountTokenMetadataProgram,
    TAccountInstructions,
    TAccountAuthorizationRulesProgram,
    TAccountAuthRules
  >
): DepositNftInstruction<
  typeof AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountOwnerAta,
  TAccountPoolAta,
  TAccountMint,
  TAccountNftReceipt,
  TAccountTokenProgram,
  TAccountSystemProgram,
  TAccountRent,
  TAccountMetadata,
  TAccountMintProof,
  TAccountEdition,
  TAccountOwnerTokenRecord,
  TAccountPoolTokenRecord,
  TAccountAssociatedTokenProgram,
  TAccountTokenMetadataProgram,
  TAccountInstructions,
  TAccountAuthorizationRulesProgram,
  TAccountAuthRules
> {
  // Program address.
  const programAddress = AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    ownerAta: { value: input.ownerAta ?? null, isWritable: true },
    poolAta: { value: input.poolAta ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    rent: { value: input.rent ?? null, isWritable: false },
    metadata: { value: input.metadata ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    edition: { value: input.edition ?? null, isWritable: false },
    ownerTokenRecord: {
      value: input.ownerTokenRecord ?? null,
      isWritable: false,
    },
    poolTokenRecord: { value: input.poolTokenRecord ?? null, isWritable: true },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.ownerAta),
      getAccountMeta(accounts.poolAta),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.rent),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.ownerTokenRecord),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.instructions),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.authRules),
    ],
    programAddress,
    data: getDepositNftInstructionDataEncoder().encode(
      args as DepositNftInstructionDataArgs
    ),
  } as DepositNftInstruction<
    typeof AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountOwnerAta,
    TAccountPoolAta,
    TAccountMint,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountSystemProgram,
    TAccountRent,
    TAccountMetadata,
    TAccountMintProof,
    TAccountEdition,
    TAccountOwnerTokenRecord,
    TAccountPoolTokenRecord,
    TAccountAssociatedTokenProgram,
    TAccountTokenMetadataProgram,
    TAccountInstructions,
    TAccountAuthorizationRulesProgram,
    TAccountAuthRules
  >;

  return instruction;
}

export type ParsedDepositNftInstruction<
  TProgram extends string = typeof AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The owner of the pool and the NFT. */
    owner: TAccountMetas[0];
    pool: TAccountMetas[1];
    /** The whitelist that gatekeeps which NFTs can be deposited into the pool. */
    whitelist: TAccountMetas[2];
    /** The ATA of the owner, where the NFT will be transferred from. */
    ownerAta: TAccountMetas[3];
    /** The ATA of the pool, where the NFT will be escrowed. */
    poolAta: TAccountMetas[4];
    /**
     * The mint account of the NFT. It should be the mint account common
     * to the owner_ata and pool_ata.
     */

    mint: TAccountMetas[5];
    /** The NFT receipt account denoting that an NFT has been deposited into a pool. */
    nftReceipt: TAccountMetas[6];
    tokenProgram: TAccountMetas[7];
    systemProgram: TAccountMetas[8];
    rent: TAccountMetas[9];
    /** The Token Metadata metadata account of the NFT. */
    metadata: TAccountMetas[10];
    /**
     * TODO: we can actually deserialize here with a MintProofV2 type
     * but may not be worth it since assert_decode_mint_proof checks
     * seeds, mint, whitelist, and key
     */

    mintProof?: TAccountMetas[11] | undefined;
    /** The Token Metadata edition account of the NFT. */
    edition: TAccountMetas[12];
    /** The Token Metadata owner/buyer token record account of the NFT. */
    ownerTokenRecord: TAccountMetas[13];
    /** The Token Metadata pool token record account of the NFT. */
    poolTokenRecord: TAccountMetas[14];
    associatedTokenProgram: TAccountMetas[15];
    /** The Token Metadata program account. */
    tokenMetadataProgram: TAccountMetas[16];
    /** The sysvar instructions account. */
    instructions: TAccountMetas[17];
    /** The Metaplex Token Authority Rules program account. */
    authorizationRulesProgram: TAccountMetas[18];
    /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
    authRules: TAccountMetas[19];
  };
  data: DepositNftInstructionData;
};

export function parseDepositNftInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedDepositNftInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 20) {
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
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      ownerAta: getNextAccount(),
      poolAta: getNextAccount(),
      mint: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      rent: getNextAccount(),
      metadata: getNextAccount(),
      mintProof: getNextOptionalAccount(),
      edition: getNextAccount(),
      ownerTokenRecord: getNextAccount(),
      poolTokenRecord: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      tokenMetadataProgram: getNextAccount(),
      instructions: getNextAccount(),
      authorizationRulesProgram: getNextAccount(),
      authRules: getNextAccount(),
    },
    data: getDepositNftInstructionDataDecoder().decode(instruction.data),
  };
}
