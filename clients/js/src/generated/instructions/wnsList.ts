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
  mapEncoder,
} from '@solana/codecs-core';
import {
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder,
  getStructEncoder,
} from '@solana/codecs-data-structures';
import {
  getU64Decoder,
  getU64Encoder,
  getU8Decoder,
  getU8Encoder,
} from '@solana/codecs-numbers';
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
import {
  ResolvedAccount,
  accountMetaWithDefault,
  getAccountMetasWithSigners,
} from '../shared';

export type WnsListInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSingleListing extends string | IAccountMeta<string> = string,
  TAccountNftSource extends string | IAccountMeta<string> = string,
  TAccountNftMint extends string | IAccountMeta<string> = string,
  TAccountNftEscrowOwner extends string | IAccountMeta<string> = string,
  TAccountNftEscrowToken extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountPayer extends string | IAccountMeta<string> = string,
  TAccountApproveAccount extends string | IAccountMeta<string> = string,
  TAccountDistribution extends string | IAccountMeta<string> = string,
  TAccountWnsProgram extends string | IAccountMeta<string> = string,
  TAccountDistributionProgram extends string | IAccountMeta<string> = string,
  TAccountExtraMetas extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSingleListing extends string
        ? WritableAccount<TAccountSingleListing>
        : TAccountSingleListing,
      TAccountNftSource extends string
        ? WritableAccount<TAccountNftSource>
        : TAccountNftSource,
      TAccountNftMint extends string
        ? ReadonlyAccount<TAccountNftMint>
        : TAccountNftMint,
      TAccountNftEscrowOwner extends string
        ? WritableAccount<TAccountNftEscrowOwner>
        : TAccountNftEscrowOwner,
      TAccountNftEscrowToken extends string
        ? WritableAccount<TAccountNftEscrowToken>
        : TAccountNftEscrowToken,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner>
        : TAccountOwner,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      TAccountPayer extends string
        ? WritableSignerAccount<TAccountPayer>
        : TAccountPayer,
      TAccountApproveAccount extends string
        ? WritableAccount<TAccountApproveAccount>
        : TAccountApproveAccount,
      TAccountDistribution extends string
        ? WritableAccount<TAccountDistribution>
        : TAccountDistribution,
      TAccountWnsProgram extends string
        ? ReadonlyAccount<TAccountWnsProgram>
        : TAccountWnsProgram,
      TAccountDistributionProgram extends string
        ? ReadonlyAccount<TAccountDistributionProgram>
        : TAccountDistributionProgram,
      TAccountExtraMetas extends string
        ? ReadonlyAccount<TAccountExtraMetas>
        : TAccountExtraMetas,
      ...TRemainingAccounts
    ]
  >;

export type WnsListInstructionWithSigners<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSingleListing extends string | IAccountMeta<string> = string,
  TAccountNftSource extends string | IAccountMeta<string> = string,
  TAccountNftMint extends string | IAccountMeta<string> = string,
  TAccountNftEscrowOwner extends string | IAccountMeta<string> = string,
  TAccountNftEscrowToken extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountPayer extends string | IAccountMeta<string> = string,
  TAccountApproveAccount extends string | IAccountMeta<string> = string,
  TAccountDistribution extends string | IAccountMeta<string> = string,
  TAccountWnsProgram extends string | IAccountMeta<string> = string,
  TAccountDistributionProgram extends string | IAccountMeta<string> = string,
  TAccountExtraMetas extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSingleListing extends string
        ? WritableAccount<TAccountSingleListing>
        : TAccountSingleListing,
      TAccountNftSource extends string
        ? WritableAccount<TAccountNftSource>
        : TAccountNftSource,
      TAccountNftMint extends string
        ? ReadonlyAccount<TAccountNftMint>
        : TAccountNftMint,
      TAccountNftEscrowOwner extends string
        ? WritableAccount<TAccountNftEscrowOwner>
        : TAccountNftEscrowOwner,
      TAccountNftEscrowToken extends string
        ? WritableAccount<TAccountNftEscrowToken>
        : TAccountNftEscrowToken,
      TAccountOwner extends string
        ? WritableSignerAccount<TAccountOwner> &
            IAccountSignerMeta<TAccountOwner>
        : TAccountOwner,
      TAccountTokenProgram extends string
        ? ReadonlyAccount<TAccountTokenProgram>
        : TAccountTokenProgram,
      TAccountAssociatedTokenProgram extends string
        ? ReadonlyAccount<TAccountAssociatedTokenProgram>
        : TAccountAssociatedTokenProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      TAccountPayer extends string
        ? WritableSignerAccount<TAccountPayer> &
            IAccountSignerMeta<TAccountPayer>
        : TAccountPayer,
      TAccountApproveAccount extends string
        ? WritableAccount<TAccountApproveAccount>
        : TAccountApproveAccount,
      TAccountDistribution extends string
        ? WritableAccount<TAccountDistribution>
        : TAccountDistribution,
      TAccountWnsProgram extends string
        ? ReadonlyAccount<TAccountWnsProgram>
        : TAccountWnsProgram,
      TAccountDistributionProgram extends string
        ? ReadonlyAccount<TAccountDistributionProgram>
        : TAccountDistributionProgram,
      TAccountExtraMetas extends string
        ? ReadonlyAccount<TAccountExtraMetas>
        : TAccountExtraMetas,
      ...TRemainingAccounts
    ]
  >;

export type WnsListInstructionData = {
  discriminator: Array<number>;
  price: bigint;
};

export type WnsListInstructionDataArgs = { price: number | bigint };

export function getWnsListInstructionDataEncoder(): Encoder<WnsListInstructionDataArgs> {
  return mapEncoder(
    getStructEncoder([
      ['discriminator', getArrayEncoder(getU8Encoder(), { size: 8 })],
      ['price', getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: [212, 193, 161, 215, 128, 43, 190, 204],
    })
  );
}

export function getWnsListInstructionDataDecoder(): Decoder<WnsListInstructionData> {
  return getStructDecoder([
    ['discriminator', getArrayDecoder(getU8Decoder(), { size: 8 })],
    ['price', getU64Decoder()],
  ]);
}

export function getWnsListInstructionDataCodec(): Codec<
  WnsListInstructionDataArgs,
  WnsListInstructionData
> {
  return combineCodec(
    getWnsListInstructionDataEncoder(),
    getWnsListInstructionDataDecoder()
  );
}

export type WnsListInput<
  TAccountSingleListing extends string,
  TAccountNftSource extends string,
  TAccountNftMint extends string,
  TAccountNftEscrowOwner extends string,
  TAccountNftEscrowToken extends string,
  TAccountOwner extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TAccountApproveAccount extends string,
  TAccountDistribution extends string,
  TAccountWnsProgram extends string,
  TAccountDistributionProgram extends string,
  TAccountExtraMetas extends string
> = {
  singleListing: Address<TAccountSingleListing>;
  nftSource: Address<TAccountNftSource>;
  nftMint: Address<TAccountNftMint>;
  nftEscrowOwner: Address<TAccountNftEscrowOwner>;
  nftEscrowToken: Address<TAccountNftEscrowToken>;
  owner: Address<TAccountOwner>;
  tokenProgram?: Address<TAccountTokenProgram>;
  associatedTokenProgram: Address<TAccountAssociatedTokenProgram>;
  systemProgram?: Address<TAccountSystemProgram>;
  payer: Address<TAccountPayer>;
  approveAccount: Address<TAccountApproveAccount>;
  distribution: Address<TAccountDistribution>;
  wnsProgram: Address<TAccountWnsProgram>;
  distributionProgram: Address<TAccountDistributionProgram>;
  extraMetas: Address<TAccountExtraMetas>;
  price: WnsListInstructionDataArgs['price'];
};

export type WnsListInputWithSigners<
  TAccountSingleListing extends string,
  TAccountNftSource extends string,
  TAccountNftMint extends string,
  TAccountNftEscrowOwner extends string,
  TAccountNftEscrowToken extends string,
  TAccountOwner extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TAccountApproveAccount extends string,
  TAccountDistribution extends string,
  TAccountWnsProgram extends string,
  TAccountDistributionProgram extends string,
  TAccountExtraMetas extends string
> = {
  singleListing: Address<TAccountSingleListing>;
  nftSource: Address<TAccountNftSource>;
  nftMint: Address<TAccountNftMint>;
  nftEscrowOwner: Address<TAccountNftEscrowOwner>;
  nftEscrowToken: Address<TAccountNftEscrowToken>;
  owner: TransactionSigner<TAccountOwner>;
  tokenProgram?: Address<TAccountTokenProgram>;
  associatedTokenProgram: Address<TAccountAssociatedTokenProgram>;
  systemProgram?: Address<TAccountSystemProgram>;
  payer: TransactionSigner<TAccountPayer>;
  approveAccount: Address<TAccountApproveAccount>;
  distribution: Address<TAccountDistribution>;
  wnsProgram: Address<TAccountWnsProgram>;
  distributionProgram: Address<TAccountDistributionProgram>;
  extraMetas: Address<TAccountExtraMetas>;
  price: WnsListInstructionDataArgs['price'];
};

export function getWnsListInstruction<
  TAccountSingleListing extends string,
  TAccountNftSource extends string,
  TAccountNftMint extends string,
  TAccountNftEscrowOwner extends string,
  TAccountNftEscrowToken extends string,
  TAccountOwner extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TAccountApproveAccount extends string,
  TAccountDistribution extends string,
  TAccountWnsProgram extends string,
  TAccountDistributionProgram extends string,
  TAccountExtraMetas extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: WnsListInputWithSigners<
    TAccountSingleListing,
    TAccountNftSource,
    TAccountNftMint,
    TAccountNftEscrowOwner,
    TAccountNftEscrowToken,
    TAccountOwner,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountPayer,
    TAccountApproveAccount,
    TAccountDistribution,
    TAccountWnsProgram,
    TAccountDistributionProgram,
    TAccountExtraMetas
  >
): WnsListInstructionWithSigners<
  TProgram,
  TAccountSingleListing,
  TAccountNftSource,
  TAccountNftMint,
  TAccountNftEscrowOwner,
  TAccountNftEscrowToken,
  TAccountOwner,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountPayer,
  TAccountApproveAccount,
  TAccountDistribution,
  TAccountWnsProgram,
  TAccountDistributionProgram,
  TAccountExtraMetas
>;
export function getWnsListInstruction<
  TAccountSingleListing extends string,
  TAccountNftSource extends string,
  TAccountNftMint extends string,
  TAccountNftEscrowOwner extends string,
  TAccountNftEscrowToken extends string,
  TAccountOwner extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TAccountApproveAccount extends string,
  TAccountDistribution extends string,
  TAccountWnsProgram extends string,
  TAccountDistributionProgram extends string,
  TAccountExtraMetas extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: WnsListInput<
    TAccountSingleListing,
    TAccountNftSource,
    TAccountNftMint,
    TAccountNftEscrowOwner,
    TAccountNftEscrowToken,
    TAccountOwner,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountPayer,
    TAccountApproveAccount,
    TAccountDistribution,
    TAccountWnsProgram,
    TAccountDistributionProgram,
    TAccountExtraMetas
  >
): WnsListInstruction<
  TProgram,
  TAccountSingleListing,
  TAccountNftSource,
  TAccountNftMint,
  TAccountNftEscrowOwner,
  TAccountNftEscrowToken,
  TAccountOwner,
  TAccountTokenProgram,
  TAccountAssociatedTokenProgram,
  TAccountSystemProgram,
  TAccountPayer,
  TAccountApproveAccount,
  TAccountDistribution,
  TAccountWnsProgram,
  TAccountDistributionProgram,
  TAccountExtraMetas
>;
export function getWnsListInstruction<
  TAccountSingleListing extends string,
  TAccountNftSource extends string,
  TAccountNftMint extends string,
  TAccountNftEscrowOwner extends string,
  TAccountNftEscrowToken extends string,
  TAccountOwner extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TAccountApproveAccount extends string,
  TAccountDistribution extends string,
  TAccountWnsProgram extends string,
  TAccountDistributionProgram extends string,
  TAccountExtraMetas extends string,
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'
>(
  input: WnsListInput<
    TAccountSingleListing,
    TAccountNftSource,
    TAccountNftMint,
    TAccountNftEscrowOwner,
    TAccountNftEscrowToken,
    TAccountOwner,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountPayer,
    TAccountApproveAccount,
    TAccountDistribution,
    TAccountWnsProgram,
    TAccountDistributionProgram,
    TAccountExtraMetas
  >
): IInstruction {
  // Program address.
  const programAddress =
    'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

  // Original accounts.
  type AccountMetas = Parameters<
    typeof getWnsListInstructionRaw<
      TProgram,
      TAccountSingleListing,
      TAccountNftSource,
      TAccountNftMint,
      TAccountNftEscrowOwner,
      TAccountNftEscrowToken,
      TAccountOwner,
      TAccountTokenProgram,
      TAccountAssociatedTokenProgram,
      TAccountSystemProgram,
      TAccountPayer,
      TAccountApproveAccount,
      TAccountDistribution,
      TAccountWnsProgram,
      TAccountDistributionProgram,
      TAccountExtraMetas
    >
  >[0];
  const accounts: Record<keyof AccountMetas, ResolvedAccount> = {
    singleListing: { value: input.singleListing ?? null, isWritable: true },
    nftSource: { value: input.nftSource ?? null, isWritable: true },
    nftMint: { value: input.nftMint ?? null, isWritable: false },
    nftEscrowOwner: { value: input.nftEscrowOwner ?? null, isWritable: true },
    nftEscrowToken: { value: input.nftEscrowToken ?? null, isWritable: true },
    owner: { value: input.owner ?? null, isWritable: true },
    tokenProgram: { value: input.tokenProgram ?? null, isWritable: false },
    associatedTokenProgram: {
      value: input.associatedTokenProgram ?? null,
      isWritable: false,
    },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    payer: { value: input.payer ?? null, isWritable: true },
    approveAccount: { value: input.approveAccount ?? null, isWritable: true },
    distribution: { value: input.distribution ?? null, isWritable: true },
    wnsProgram: { value: input.wnsProgram ?? null, isWritable: false },
    distributionProgram: {
      value: input.distributionProgram ?? null,
      isWritable: false,
    },
    extraMetas: { value: input.extraMetas ?? null, isWritable: false },
  };

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

  // Get account metas and signers.
  const accountMetas = getAccountMetasWithSigners(
    accounts,
    'programId',
    programAddress
  );

  const instruction = getWnsListInstructionRaw(
    accountMetas as Record<keyof AccountMetas, IAccountMeta>,
    args as WnsListInstructionDataArgs,
    programAddress
  );

  return instruction;
}

export function getWnsListInstructionRaw<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountSingleListing extends string | IAccountMeta<string> = string,
  TAccountNftSource extends string | IAccountMeta<string> = string,
  TAccountNftMint extends string | IAccountMeta<string> = string,
  TAccountNftEscrowOwner extends string | IAccountMeta<string> = string,
  TAccountNftEscrowToken extends string | IAccountMeta<string> = string,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountTokenProgram extends
    | string
    | IAccountMeta<string> = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TAccountAssociatedTokenProgram extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TAccountPayer extends string | IAccountMeta<string> = string,
  TAccountApproveAccount extends string | IAccountMeta<string> = string,
  TAccountDistribution extends string | IAccountMeta<string> = string,
  TAccountWnsProgram extends string | IAccountMeta<string> = string,
  TAccountDistributionProgram extends string | IAccountMeta<string> = string,
  TAccountExtraMetas extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends Array<IAccountMeta<string>> = []
>(
  accounts: {
    singleListing: TAccountSingleListing extends string
      ? Address<TAccountSingleListing>
      : TAccountSingleListing;
    nftSource: TAccountNftSource extends string
      ? Address<TAccountNftSource>
      : TAccountNftSource;
    nftMint: TAccountNftMint extends string
      ? Address<TAccountNftMint>
      : TAccountNftMint;
    nftEscrowOwner: TAccountNftEscrowOwner extends string
      ? Address<TAccountNftEscrowOwner>
      : TAccountNftEscrowOwner;
    nftEscrowToken: TAccountNftEscrowToken extends string
      ? Address<TAccountNftEscrowToken>
      : TAccountNftEscrowToken;
    owner: TAccountOwner extends string
      ? Address<TAccountOwner>
      : TAccountOwner;
    tokenProgram?: TAccountTokenProgram extends string
      ? Address<TAccountTokenProgram>
      : TAccountTokenProgram;
    associatedTokenProgram: TAccountAssociatedTokenProgram extends string
      ? Address<TAccountAssociatedTokenProgram>
      : TAccountAssociatedTokenProgram;
    systemProgram?: TAccountSystemProgram extends string
      ? Address<TAccountSystemProgram>
      : TAccountSystemProgram;
    payer: TAccountPayer extends string
      ? Address<TAccountPayer>
      : TAccountPayer;
    approveAccount: TAccountApproveAccount extends string
      ? Address<TAccountApproveAccount>
      : TAccountApproveAccount;
    distribution: TAccountDistribution extends string
      ? Address<TAccountDistribution>
      : TAccountDistribution;
    wnsProgram: TAccountWnsProgram extends string
      ? Address<TAccountWnsProgram>
      : TAccountWnsProgram;
    distributionProgram: TAccountDistributionProgram extends string
      ? Address<TAccountDistributionProgram>
      : TAccountDistributionProgram;
    extraMetas: TAccountExtraMetas extends string
      ? Address<TAccountExtraMetas>
      : TAccountExtraMetas;
  },
  args: WnsListInstructionDataArgs,
  programAddress: Address<TProgram> = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<TProgram>,
  remainingAccounts?: TRemainingAccounts
) {
  return {
    accounts: [
      accountMetaWithDefault(accounts.singleListing, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.nftSource, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.nftMint, AccountRole.READONLY),
      accountMetaWithDefault(accounts.nftEscrowOwner, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.nftEscrowToken, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.owner, AccountRole.WRITABLE_SIGNER),
      accountMetaWithDefault(
        accounts.tokenProgram ??
          ('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>),
        AccountRole.READONLY
      ),
      accountMetaWithDefault(
        accounts.associatedTokenProgram,
        AccountRole.READONLY
      ),
      accountMetaWithDefault(
        accounts.systemProgram ??
          ('11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>),
        AccountRole.READONLY
      ),
      accountMetaWithDefault(accounts.payer, AccountRole.WRITABLE_SIGNER),
      accountMetaWithDefault(accounts.approveAccount, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.distribution, AccountRole.WRITABLE),
      accountMetaWithDefault(accounts.wnsProgram, AccountRole.READONLY),
      accountMetaWithDefault(
        accounts.distributionProgram,
        AccountRole.READONLY
      ),
      accountMetaWithDefault(accounts.extraMetas, AccountRole.READONLY),
      ...(remainingAccounts ?? []),
    ],
    data: getWnsListInstructionDataEncoder().encode(args),
    programAddress,
  } as WnsListInstruction<
    TProgram,
    TAccountSingleListing,
    TAccountNftSource,
    TAccountNftMint,
    TAccountNftEscrowOwner,
    TAccountNftEscrowToken,
    TAccountOwner,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram,
    TAccountPayer,
    TAccountApproveAccount,
    TAccountDistribution,
    TAccountWnsProgram,
    TAccountDistributionProgram,
    TAccountExtraMetas,
    TRemainingAccounts
  >;
}

export type ParsedWnsListInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[]
> = {
  programAddress: Address<TProgram>;
  accounts: {
    singleListing: TAccountMetas[0];
    nftSource: TAccountMetas[1];
    nftMint: TAccountMetas[2];
    nftEscrowOwner: TAccountMetas[3];
    nftEscrowToken: TAccountMetas[4];
    owner: TAccountMetas[5];
    tokenProgram: TAccountMetas[6];
    associatedTokenProgram: TAccountMetas[7];
    systemProgram: TAccountMetas[8];
    payer: TAccountMetas[9];
    approveAccount: TAccountMetas[10];
    distribution: TAccountMetas[11];
    wnsProgram: TAccountMetas[12];
    distributionProgram: TAccountMetas[13];
    extraMetas: TAccountMetas[14];
  };
  data: WnsListInstructionData;
};

export function parseWnsListInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[]
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedWnsListInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 15) {
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
      singleListing: getNextAccount(),
      nftSource: getNextAccount(),
      nftMint: getNextAccount(),
      nftEscrowOwner: getNextAccount(),
      nftEscrowToken: getNextAccount(),
      owner: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
      payer: getNextAccount(),
      approveAccount: getNextAccount(),
      distribution: getNextAccount(),
      wnsProgram: getNextAccount(),
      distributionProgram: getNextAccount(),
      extraMetas: getNextAccount(),
    },
    data: getWnsListInstructionDataDecoder().decode(instruction.data),
  };
}
