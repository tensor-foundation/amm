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
  getOptionDecoder,
  getOptionEncoder,
  getStructDecoder,
  getStructEncoder,
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
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import {
  TokenStandard,
  resolveAuthorizationRulesProgramFromTokenStandard,
  resolveEditionFromTokenStandard,
  resolveMetadata,
  resolveOwnerAta,
  resolvePoolAta,
  resolvePoolTokenRecordFromTokenStandard,
  resolveSysvarInstructionsFromTokenStandard,
  resolveTokenMetadataProgramFromTokenStandard,
  type TokenStandardArgs,
} from '@tensor-foundation/resolvers';
import { resolveUserTokenRecordFromTokenStandard } from '../../hooked';
import { findNftDepositReceiptPda } from '../pdas';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';
import {
  getAuthorizationDataLocalDecoder,
  getAuthorizationDataLocalEncoder,
  type AuthorizationDataLocal,
  type AuthorizationDataLocalArgs,
} from '../types';

export type DepositNftInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountMetadata extends string | IAccountMeta<string> = string,
  TAccountEdition extends string | IAccountMeta<string> = string,
  TAccountUserTokenRecord extends string | IAccountMeta<string> = string,
  TAccountPoolTokenRecord extends string | IAccountMeta<string> = string,
  TAccountTokenMetadataProgram extends string | IAccountMeta<string> = string,
  TAccountSysvarInstructions extends string | IAccountMeta<string> = string,
  TAccountAuthorizationRules extends string | IAccountMeta<string> = string,
  TAccountAuthorizationRulesProgram extends
    | string
    | IAccountMeta<string> = string,
  TAccountNftReceipt extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountOwnerTa extends string | IAccountMeta<string> = string,
  TAccountPoolTa extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
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
      TAccountMetadata extends string
        ? WritableAccount<TAccountMetadata>
        : TAccountMetadata,
      TAccountEdition extends string
        ? ReadonlyAccount<TAccountEdition>
        : TAccountEdition,
      TAccountUserTokenRecord extends string
        ? WritableAccount<TAccountUserTokenRecord>
        : TAccountUserTokenRecord,
      TAccountPoolTokenRecord extends string
        ? WritableAccount<TAccountPoolTokenRecord>
        : TAccountPoolTokenRecord,
      TAccountTokenMetadataProgram extends string
        ? ReadonlyAccount<TAccountTokenMetadataProgram>
        : TAccountTokenMetadataProgram,
      TAccountSysvarInstructions extends string
        ? ReadonlyAccount<TAccountSysvarInstructions>
        : TAccountSysvarInstructions,
      TAccountAuthorizationRules extends string
        ? ReadonlyAccount<TAccountAuthorizationRules>
        : TAccountAuthorizationRules,
      TAccountAuthorizationRulesProgram extends string
        ? ReadonlyAccount<TAccountAuthorizationRulesProgram>
        : TAccountAuthorizationRulesProgram,
      TAccountNftReceipt extends string
        ? WritableAccount<TAccountNftReceipt>
        : TAccountNftReceipt,
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
      TAccountOwnerTa extends string
        ? WritableAccount<TAccountOwnerTa>
        : TAccountOwnerTa,
      TAccountPoolTa extends string
        ? WritableAccount<TAccountPoolTa>
        : TAccountPoolTa,
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

export type DepositNftInstructionData = {
  discriminator: ReadonlyUint8Array;
  authorizationData: Option<AuthorizationDataLocal>;
};

export type DepositNftInstructionDataArgs = {
  authorizationData?: OptionOrNullable<AuthorizationDataLocalArgs>;
};

export function getDepositNftInstructionDataEncoder(): Encoder<DepositNftInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      [
        'authorizationData',
        getOptionEncoder(getAuthorizationDataLocalEncoder()),
      ],
    ]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([93, 226, 132, 166, 141, 9, 48, 101]),
      authorizationData: value.authorizationData ?? none(),
    })
  );
}

export function getDepositNftInstructionDataDecoder(): Decoder<DepositNftInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
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

export type DepositNftInstructionExtraArgs = {
  tokenStandard?: TokenStandardArgs;
};

export type DepositNftAsyncInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMetadata extends string = string,
  TAccountEdition extends string = string,
  TAccountUserTokenRecord extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountSysvarInstructions extends string = string,
  TAccountAuthorizationRules extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool the NFT is being transferred to/from. */
  pool: Address<TAccountPool>;
  /**
   * The whitelist that gatekeeps which NFTs can be deposited into the pool.
   * Must match the whitelist stored in the pool state.
   */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The Token Metadata metadata account of the NFT. */
  metadata?: Address<TAccountMetadata>;
  /** The Token Metadata edition account of the NFT. */
  edition?: Address<TAccountEdition>;
  /** The Token Metadata source token record account of the NFT. */
  userTokenRecord?: Address<TAccountUserTokenRecord>;
  /** The Token Metadata token record for the destination. */
  poolTokenRecord?: Address<TAccountPoolTokenRecord>;
  /** The Token Metadata program account. */
  tokenMetadataProgram?: Address<TAccountTokenMetadataProgram>;
  /** The sysvar instructions account. */
  sysvarInstructions?: Address<TAccountSysvarInstructions>;
  /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
  authorizationRules?: Address<TAccountAuthorizationRules>;
  /** The Metaplex Token Authority Rules program account. */
  authorizationRulesProgram?: Address<TAccountAuthorizationRulesProgram>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ta and pool_ta.
   */
  mint: Address<TAccountMint>;
  /** The token account of the owner, where the NFT will be transferred from. */
  ownerTa?: Address<TAccountOwnerTa>;
  /** The token account of the pool, where the NFT will be escrowed. */
  poolTa?: Address<TAccountPoolTa>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  authorizationData?: DepositNftInstructionDataArgs['authorizationData'];
  tokenStandard?: DepositNftInstructionExtraArgs['tokenStandard'];
};

export async function getDepositNftInstructionAsync<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMetadata extends string,
  TAccountEdition extends string,
  TAccountUserTokenRecord extends string,
  TAccountPoolTokenRecord extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountSysvarInstructions extends string,
  TAccountAuthorizationRules extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountNftReceipt extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: DepositNftAsyncInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): Promise<
  DepositNftInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    metadata: { value: input.metadata ?? null, isWritable: true },
    edition: { value: input.edition ?? null, isWritable: false },
    userTokenRecord: { value: input.userTokenRecord ?? null, isWritable: true },
    poolTokenRecord: { value: input.poolTokenRecord ?? null, isWritable: true },
    tokenMetadataProgram: {
      value: input.tokenMetadataProgram ?? null,
      isWritable: false,
    },
    sysvarInstructions: {
      value: input.sysvarInstructions ?? null,
      isWritable: false,
    },
    authorizationRules: {
      value: input.authorizationRules ?? null,
      isWritable: false,
    },
    authorizationRulesProgram: {
      value: input.authorizationRulesProgram ?? null,
      isWritable: false,
    },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
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
  if (!accounts.metadata.value) {
    accounts.metadata = {
      ...accounts.metadata,
      ...(await resolveMetadata(resolverScope)),
    };
  }
  if (!accounts.edition.value) {
    accounts.edition = {
      ...accounts.edition,
      ...(await resolveEditionFromTokenStandard(resolverScope)),
    };
  }
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!accounts.ownerTa.value) {
    accounts.ownerTa = {
      ...accounts.ownerTa,
      ...(await resolveOwnerAta(resolverScope)),
    };
  }
  if (!accounts.userTokenRecord.value) {
    accounts.userTokenRecord = {
      ...accounts.userTokenRecord,
      ...(await resolveUserTokenRecordFromTokenStandard(resolverScope)),
    };
  }
  if (!accounts.poolTa.value) {
    accounts.poolTa = {
      ...accounts.poolTa,
      ...(await resolvePoolAta(resolverScope)),
    };
  }
  if (!accounts.poolTokenRecord.value) {
    accounts.poolTokenRecord = {
      ...accounts.poolTokenRecord,
      ...(await resolvePoolTokenRecordFromTokenStandard(resolverScope)),
    };
  }
  if (!args.tokenStandard) {
    args.tokenStandard = TokenStandard.ProgrammableNonFungible;
  }
  if (!accounts.tokenMetadataProgram.value) {
    accounts.tokenMetadataProgram = {
      ...accounts.tokenMetadataProgram,
      ...resolveTokenMetadataProgramFromTokenStandard(resolverScope),
    };
  }
  if (!accounts.sysvarInstructions.value) {
    accounts.sysvarInstructions = {
      ...accounts.sysvarInstructions,
      ...resolveSysvarInstructionsFromTokenStandard(resolverScope),
    };
  }
  if (!accounts.authorizationRulesProgram.value) {
    accounts.authorizationRulesProgram = {
      ...accounts.authorizationRulesProgram,
      ...resolveAuthorizationRulesProgramFromTokenStandard(resolverScope),
    };
  }
  if (!accounts.nftReceipt.value) {
    accounts.nftReceipt.value = await findNftDepositReceiptPda({
      mint: expectAddress(accounts.mint.value),
      pool: expectAddress(accounts.pool.value),
    });
  }
  if (!accounts.associatedTokenProgram.value) {
    accounts.associatedTokenProgram.value =
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address<'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'>;
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.userTokenRecord),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.sysvarInstructions),
      getAccountMeta(accounts.authorizationRules),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getDepositNftInstructionDataEncoder().encode(
      args as DepositNftInstructionDataArgs
    ),
  } as DepositNftInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type DepositNftInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMetadata extends string = string,
  TAccountEdition extends string = string,
  TAccountUserTokenRecord extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountSysvarInstructions extends string = string,
  TAccountAuthorizationRules extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool the NFT is being transferred to/from. */
  pool: Address<TAccountPool>;
  /**
   * The whitelist that gatekeeps which NFTs can be deposited into the pool.
   * Must match the whitelist stored in the pool state.
   */
  whitelist: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The Token Metadata metadata account of the NFT. */
  metadata: Address<TAccountMetadata>;
  /** The Token Metadata edition account of the NFT. */
  edition: Address<TAccountEdition>;
  /** The Token Metadata source token record account of the NFT. */
  userTokenRecord?: Address<TAccountUserTokenRecord>;
  /** The Token Metadata token record for the destination. */
  poolTokenRecord?: Address<TAccountPoolTokenRecord>;
  /** The Token Metadata program account. */
  tokenMetadataProgram?: Address<TAccountTokenMetadataProgram>;
  /** The sysvar instructions account. */
  sysvarInstructions?: Address<TAccountSysvarInstructions>;
  /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
  authorizationRules?: Address<TAccountAuthorizationRules>;
  /** The Metaplex Token Authority Rules program account. */
  authorizationRulesProgram?: Address<TAccountAuthorizationRulesProgram>;
  /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
  nftReceipt: Address<TAccountNftReceipt>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ta and pool_ta.
   */
  mint: Address<TAccountMint>;
  /** The token account of the owner, where the NFT will be transferred from. */
  ownerTa: Address<TAccountOwnerTa>;
  /** The token account of the pool, where the NFT will be escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  authorizationData?: DepositNftInstructionDataArgs['authorizationData'];
  tokenStandard?: DepositNftInstructionExtraArgs['tokenStandard'];
};

export function getDepositNftInstruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMetadata extends string,
  TAccountEdition extends string,
  TAccountUserTokenRecord extends string,
  TAccountPoolTokenRecord extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountSysvarInstructions extends string,
  TAccountAuthorizationRules extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountNftReceipt extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: DepositNftInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): DepositNftInstruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountMetadata,
  TAccountEdition,
  TAccountUserTokenRecord,
  TAccountPoolTokenRecord,
  TAccountTokenMetadataProgram,
  TAccountSysvarInstructions,
  TAccountAuthorizationRules,
  TAccountAuthorizationRulesProgram,
  TAccountNftReceipt,
  TAccountMint,
  TAccountOwnerTa,
  TAccountPoolTa,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    metadata: { value: input.metadata ?? null, isWritable: true },
    edition: { value: input.edition ?? null, isWritable: false },
    userTokenRecord: { value: input.userTokenRecord ?? null, isWritable: true },
    poolTokenRecord: { value: input.poolTokenRecord ?? null, isWritable: true },
    tokenMetadataProgram: {
      value: input.tokenMetadataProgram ?? null,
      isWritable: false,
    },
    sysvarInstructions: {
      value: input.sysvarInstructions ?? null,
      isWritable: false,
    },
    authorizationRules: {
      value: input.authorizationRules ?? null,
      isWritable: false,
    },
    authorizationRulesProgram: {
      value: input.authorizationRulesProgram ?? null,
      isWritable: false,
    },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
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
  if (!accounts.tokenProgram.value) {
    accounts.tokenProgram.value =
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;
  }
  if (!args.tokenStandard) {
    args.tokenStandard = TokenStandard.ProgrammableNonFungible;
  }
  if (!accounts.tokenMetadataProgram.value) {
    accounts.tokenMetadataProgram = {
      ...accounts.tokenMetadataProgram,
      ...resolveTokenMetadataProgramFromTokenStandard(resolverScope),
    };
  }
  if (!accounts.sysvarInstructions.value) {
    accounts.sysvarInstructions = {
      ...accounts.sysvarInstructions,
      ...resolveSysvarInstructionsFromTokenStandard(resolverScope),
    };
  }
  if (!accounts.authorizationRulesProgram.value) {
    accounts.authorizationRulesProgram = {
      ...accounts.authorizationRulesProgram,
      ...resolveAuthorizationRulesProgramFromTokenStandard(resolverScope),
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.userTokenRecord),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.sysvarInstructions),
      getAccountMeta(accounts.authorizationRules),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getDepositNftInstructionDataEncoder().encode(
      args as DepositNftInstructionDataArgs
    ),
  } as DepositNftInstruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedDepositNftInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The owner of the pool and the NFT. */
    owner: TAccountMetas[0];
    /** The pool the NFT is being transferred to/from. */
    pool: TAccountMetas[1];
    /**
     * The whitelist that gatekeeps which NFTs can be deposited into the pool.
     * Must match the whitelist stored in the pool state.
     */

    whitelist: TAccountMetas[2];
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[3] | undefined;
    /** The Token Metadata metadata account of the NFT. */
    metadata: TAccountMetas[4];
    /** The Token Metadata edition account of the NFT. */
    edition: TAccountMetas[5];
    /** The Token Metadata source token record account of the NFT. */
    userTokenRecord?: TAccountMetas[6] | undefined;
    /** The Token Metadata token record for the destination. */
    poolTokenRecord?: TAccountMetas[7] | undefined;
    /** The Token Metadata program account. */
    tokenMetadataProgram?: TAccountMetas[8] | undefined;
    /** The sysvar instructions account. */
    sysvarInstructions?: TAccountMetas[9] | undefined;
    /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
    authorizationRules?: TAccountMetas[10] | undefined;
    /** The Metaplex Token Authority Rules program account. */
    authorizationRulesProgram?: TAccountMetas[11] | undefined;
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[12];
    /**
     * The mint account of the NFT. It should be the mint account common
     * to the owner_ta and pool_ta.
     */

    mint: TAccountMetas[13];
    /** The token account of the owner, where the NFT will be transferred from. */
    ownerTa: TAccountMetas[14];
    /** The token account of the pool, where the NFT will be escrowed. */
    poolTa: TAccountMetas[15];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[16];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[17];
    /** The Solana system program. */
    systemProgram: TAccountMetas[18];
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
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      mintProof: getNextOptionalAccount(),
      metadata: getNextAccount(),
      edition: getNextAccount(),
      userTokenRecord: getNextOptionalAccount(),
      poolTokenRecord: getNextOptionalAccount(),
      tokenMetadataProgram: getNextOptionalAccount(),
      sysvarInstructions: getNextOptionalAccount(),
      authorizationRules: getNextOptionalAccount(),
      authorizationRulesProgram: getNextOptionalAccount(),
      nftReceipt: getNextAccount(),
      mint: getNextAccount(),
      ownerTa: getNextAccount(),
      poolTa: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getDepositNftInstructionDataDecoder().decode(instruction.data),
  };
}
