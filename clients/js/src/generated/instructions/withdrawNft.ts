/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
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
  type TokenStandardArgs,
} from '@tensor-foundation/mpl-token-metadata';
import {
  resolveAuthorizationRulesProgramFromTokenStandard,
  resolveMetadata,
  resolveOwnerAta,
  resolvePoolAta,
  resolvePoolTokenRecordFromTokenStandard,
  resolveSysvarInstructionsFromTokenStandard,
  resolveTokenMetadataProgramFromTokenStandard,
} from '@tensor-foundation/resolvers';
import {
  resolveEdition,
  resolveUserTokenRecordFromTokenStandard,
} from '../../hooked';
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

export const WITHDRAW_NFT_DISCRIMINATOR = new Uint8Array([
  142, 181, 191, 149, 82, 175, 216, 100,
]);

export function getWithdrawNftDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    WITHDRAW_NFT_DISCRIMINATOR
  );
}

export type WithdrawNftInstruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
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
      TAccountMint extends string
        ? ReadonlyAccount<TAccountMint>
        : TAccountMint,
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

export type WithdrawNftInstructionData = {
  discriminator: ReadonlyUint8Array;
  authorizationData: Option<AuthorizationDataLocal>;
};

export type WithdrawNftInstructionDataArgs = {
  authorizationData?: OptionOrNullable<AuthorizationDataLocalArgs>;
};

export function getWithdrawNftInstructionDataEncoder(): Encoder<WithdrawNftInstructionDataArgs> {
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
      discriminator: WITHDRAW_NFT_DISCRIMINATOR,
      authorizationData: value.authorizationData ?? none(),
    })
  );
}

export function getWithdrawNftInstructionDataDecoder(): Decoder<WithdrawNftInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['authorizationData', getOptionDecoder(getAuthorizationDataLocalDecoder())],
  ]);
}

export function getWithdrawNftInstructionDataCodec(): Codec<
  WithdrawNftInstructionDataArgs,
  WithdrawNftInstructionData
> {
  return combineCodec(
    getWithdrawNftInstructionDataEncoder(),
    getWithdrawNftInstructionDataDecoder()
  );
}

export type WithdrawNftInstructionExtraArgs = {
  tokenStandard?: TokenStandardArgs;
};

export type WithdrawNftAsyncInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountMetadata extends string = string,
  TAccountEdition extends string = string,
  TAccountUserTokenRecord extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountSysvarInstructions extends string = string,
  TAccountAuthorizationRules extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountNftReceipt extends string = string,
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
  whitelist?: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The mint account of the NFT. */
  mint: Address<TAccountMint>;
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
  /** The TA of the owner, where the NFT will be transferred to as a result of this action. */
  ownerTa?: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT token is escrowed. */
  poolTa?: Address<TAccountPoolTa>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  authorizationData?: WithdrawNftInstructionDataArgs['authorizationData'];
  tokenStandard?: WithdrawNftInstructionExtraArgs['tokenStandard'];
};

export async function getWithdrawNftInstructionAsync<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountMetadata extends string,
  TAccountEdition extends string,
  TAccountUserTokenRecord extends string,
  TAccountPoolTokenRecord extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountSysvarInstructions extends string,
  TAccountAuthorizationRules extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountNftReceipt extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof TENSOR_AMM_PROGRAM_ADDRESS,
>(
  input: WithdrawNftAsyncInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): Promise<
  WithdrawNftInstruction<
    TProgramAddress,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress = config?.programAddress ?? TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    mint: { value: input.mint ?? null, isWritable: false },
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
      ...(await resolveEdition(resolverScope)),
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
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.userTokenRecord),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.sysvarInstructions),
      getAccountMeta(accounts.authorizationRules),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftInstructionDataEncoder().encode(
      args as WithdrawNftInstructionDataArgs
    ),
  } as WithdrawNftInstruction<
    TProgramAddress,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type WithdrawNftInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountMetadata extends string = string,
  TAccountEdition extends string = string,
  TAccountUserTokenRecord extends string = string,
  TAccountPoolTokenRecord extends string = string,
  TAccountTokenMetadataProgram extends string = string,
  TAccountSysvarInstructions extends string = string,
  TAccountAuthorizationRules extends string = string,
  TAccountAuthorizationRulesProgram extends string = string,
  TAccountNftReceipt extends string = string,
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
  whitelist?: Address<TAccountWhitelist>;
  /**
   * Optional account which must be passed in if the NFT must be verified against a
   * merkle proof condition in the whitelist.
   */
  mintProof?: Address<TAccountMintProof>;
  /** The mint account of the NFT. */
  mint: Address<TAccountMint>;
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
  /** The TA of the owner, where the NFT will be transferred to as a result of this action. */
  ownerTa: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT token is escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
  authorizationData?: WithdrawNftInstructionDataArgs['authorizationData'];
  tokenStandard?: WithdrawNftInstructionExtraArgs['tokenStandard'];
};

export function getWithdrawNftInstruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountMetadata extends string,
  TAccountEdition extends string,
  TAccountUserTokenRecord extends string,
  TAccountPoolTokenRecord extends string,
  TAccountTokenMetadataProgram extends string,
  TAccountSysvarInstructions extends string,
  TAccountAuthorizationRules extends string,
  TAccountAuthorizationRulesProgram extends string,
  TAccountNftReceipt extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof TENSOR_AMM_PROGRAM_ADDRESS,
>(
  input: WithdrawNftInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): WithdrawNftInstruction<
  TProgramAddress,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountMint,
  TAccountMetadata,
  TAccountEdition,
  TAccountUserTokenRecord,
  TAccountPoolTokenRecord,
  TAccountTokenMetadataProgram,
  TAccountSysvarInstructions,
  TAccountAuthorizationRules,
  TAccountAuthorizationRulesProgram,
  TAccountNftReceipt,
  TAccountOwnerTa,
  TAccountPoolTa,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress = config?.programAddress ?? TENSOR_AMM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    owner: { value: input.owner ?? null, isWritable: true },
    pool: { value: input.pool ?? null, isWritable: true },
    whitelist: { value: input.whitelist ?? null, isWritable: false },
    mintProof: { value: input.mintProof ?? null, isWritable: false },
    mint: { value: input.mint ?? null, isWritable: false },
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
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.metadata),
      getAccountMeta(accounts.edition),
      getAccountMeta(accounts.userTokenRecord),
      getAccountMeta(accounts.poolTokenRecord),
      getAccountMeta(accounts.tokenMetadataProgram),
      getAccountMeta(accounts.sysvarInstructions),
      getAccountMeta(accounts.authorizationRules),
      getAccountMeta(accounts.authorizationRulesProgram),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getWithdrawNftInstructionDataEncoder().encode(
      args as WithdrawNftInstructionDataArgs
    ),
  } as WithdrawNftInstruction<
    TProgramAddress,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountMetadata,
    TAccountEdition,
    TAccountUserTokenRecord,
    TAccountPoolTokenRecord,
    TAccountTokenMetadataProgram,
    TAccountSysvarInstructions,
    TAccountAuthorizationRules,
    TAccountAuthorizationRulesProgram,
    TAccountNftReceipt,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedWithdrawNftInstruction<
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

    whitelist?: TAccountMetas[2] | undefined;
    /**
     * Optional account which must be passed in if the NFT must be verified against a
     * merkle proof condition in the whitelist.
     */

    mintProof?: TAccountMetas[3] | undefined;
    /** The mint account of the NFT. */
    mint: TAccountMetas[4];
    /** The Token Metadata metadata account of the NFT. */
    metadata: TAccountMetas[5];
    /** The Token Metadata edition account of the NFT. */
    edition: TAccountMetas[6];
    /** The Token Metadata source token record account of the NFT. */
    userTokenRecord?: TAccountMetas[7] | undefined;
    /** The Token Metadata token record for the destination. */
    poolTokenRecord?: TAccountMetas[8] | undefined;
    /** The Token Metadata program account. */
    tokenMetadataProgram?: TAccountMetas[9] | undefined;
    /** The sysvar instructions account. */
    sysvarInstructions?: TAccountMetas[10] | undefined;
    /** The Metaplex Token Authority Rules account that stores royalty enforcement rules. */
    authorizationRules?: TAccountMetas[11] | undefined;
    /** The Metaplex Token Authority Rules program account. */
    authorizationRulesProgram?: TAccountMetas[12] | undefined;
    /** The NFT deposit receipt, which ties an NFT to the pool it was deposited to. */
    nftReceipt: TAccountMetas[13];
    /** The TA of the owner, where the NFT will be transferred to as a result of this action. */
    ownerTa: TAccountMetas[14];
    /** The TA of the pool, where the NFT token is escrowed. */
    poolTa: TAccountMetas[15];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[16];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[17];
    /** The Solana system program. */
    systemProgram: TAccountMetas[18];
  };
  data: WithdrawNftInstructionData;
};

export function parseWithdrawNftInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedWithdrawNftInstruction<TProgram, TAccountMetas> {
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
      whitelist: getNextOptionalAccount(),
      mintProof: getNextOptionalAccount(),
      mint: getNextAccount(),
      metadata: getNextAccount(),
      edition: getNextAccount(),
      userTokenRecord: getNextOptionalAccount(),
      poolTokenRecord: getNextOptionalAccount(),
      tokenMetadataProgram: getNextOptionalAccount(),
      sysvarInstructions: getNextOptionalAccount(),
      authorizationRules: getNextOptionalAccount(),
      authorizationRulesProgram: getNextOptionalAccount(),
      nftReceipt: getNextAccount(),
      ownerTa: getNextAccount(),
      poolTa: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getWithdrawNftInstructionDataDecoder().decode(instruction.data),
  };
}
