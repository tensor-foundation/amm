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
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import {
  resolveOwnerAta,
  resolvePoolNftReceipt,
} from '@tensor-foundation/resolvers';
import { TENSOR_AMM_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export type DepositNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner extends string | IAccountMeta<string> = string,
  TAccountPool extends string | IAccountMeta<string> = string,
  TAccountWhitelist extends string | IAccountMeta<string> = string,
  TAccountMintProof extends string | IAccountMeta<string> = string,
  TAccountMint extends string | IAccountMeta<string> = string,
  TAccountOwnerTa extends string | IAccountMeta<string> = string,
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
      TAccountOwnerTa extends string
        ? WritableAccount<TAccountOwnerTa>
        : TAccountOwnerTa,
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
      ...TRemainingAccounts,
    ]
  >;

export type DepositNftT22InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type DepositNftT22InstructionDataArgs = {};

export function getDepositNftT22InstructionDataEncoder(): Encoder<DepositNftT22InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([['discriminator', fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: new Uint8Array([208, 34, 6, 147, 95, 218, 49, 160]),
    })
  );
}

export function getDepositNftT22InstructionDataDecoder(): Decoder<DepositNftT22InstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getDepositNftT22InstructionDataCodec(): Codec<
  DepositNftT22InstructionDataArgs,
  DepositNftT22InstructionData
> {
  return combineCodec(
    getDepositNftT22InstructionDataEncoder(),
    getDepositNftT22InstructionDataDecoder()
  );
}

export type DepositNftT22AsyncInput<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool to deposit the NFT into. */
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be deposited into the pool. */
  whitelist: Address<TAccountWhitelist>;
  mintProof: Address<TAccountMintProof>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ta and pool_ta.
   */
  mint: Address<TAccountMint>;
  /** The TA of the owner, where the NFT will be transferred from. */
  ownerTa?: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT will be escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
  nftReceipt?: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export async function getDepositNftT22InstructionAsync<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: DepositNftT22AsyncInput<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): Promise<
  DepositNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
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
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
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

  // Resolver scope.
  const resolverScope = { programAddress, accounts };

  // Resolve default values.
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getDepositNftT22InstructionDataEncoder().encode({}),
  } as DepositNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type DepositNftT22Input<
  TAccountOwner extends string = string,
  TAccountPool extends string = string,
  TAccountWhitelist extends string = string,
  TAccountMintProof extends string = string,
  TAccountMint extends string = string,
  TAccountOwnerTa extends string = string,
  TAccountPoolTa extends string = string,
  TAccountNftReceipt extends string = string,
  TAccountTokenProgram extends string = string,
  TAccountAssociatedTokenProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The owner of the pool and the NFT. */
  owner: TransactionSigner<TAccountOwner>;
  /** The pool to deposit the NFT into. */
  pool: Address<TAccountPool>;
  /** The whitelist that gatekeeps which NFTs can be deposited into the pool. */
  whitelist: Address<TAccountWhitelist>;
  mintProof: Address<TAccountMintProof>;
  /**
   * The mint account of the NFT. It should be the mint account common
   * to the owner_ta and pool_ta.
   */
  mint: Address<TAccountMint>;
  /** The TA of the owner, where the NFT will be transferred from. */
  ownerTa: Address<TAccountOwnerTa>;
  /** The TA of the pool, where the NFT will be escrowed. */
  poolTa: Address<TAccountPoolTa>;
  /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
  nftReceipt: Address<TAccountNftReceipt>;
  /** The SPL Token program for the Mint and ATAs. */
  tokenProgram?: Address<TAccountTokenProgram>;
  /** The SPL associated token program. */
  associatedTokenProgram?: Address<TAccountAssociatedTokenProgram>;
  /** The Solana system program. */
  systemProgram?: Address<TAccountSystemProgram>;
};

export function getDepositNftT22Instruction<
  TAccountOwner extends string,
  TAccountPool extends string,
  TAccountWhitelist extends string,
  TAccountMintProof extends string,
  TAccountMint extends string,
  TAccountOwnerTa extends string,
  TAccountPoolTa extends string,
  TAccountNftReceipt extends string,
  TAccountTokenProgram extends string,
  TAccountAssociatedTokenProgram extends string,
  TAccountSystemProgram extends string,
>(
  input: DepositNftT22Input<
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >
): DepositNftT22Instruction<
  typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountOwner,
  TAccountPool,
  TAccountWhitelist,
  TAccountMintProof,
  TAccountMint,
  TAccountOwnerTa,
  TAccountPoolTa,
  TAccountNftReceipt,
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
    mint: { value: input.mint ?? null, isWritable: false },
    ownerTa: { value: input.ownerTa ?? null, isWritable: true },
    poolTa: { value: input.poolTa ?? null, isWritable: true },
    nftReceipt: { value: input.nftReceipt ?? null, isWritable: true },
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

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.owner),
      getAccountMeta(accounts.pool),
      getAccountMeta(accounts.whitelist),
      getAccountMeta(accounts.mintProof),
      getAccountMeta(accounts.mint),
      getAccountMeta(accounts.ownerTa),
      getAccountMeta(accounts.poolTa),
      getAccountMeta(accounts.nftReceipt),
      getAccountMeta(accounts.tokenProgram),
      getAccountMeta(accounts.associatedTokenProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getDepositNftT22InstructionDataEncoder().encode({}),
  } as DepositNftT22Instruction<
    typeof TENSOR_AMM_PROGRAM_ADDRESS,
    TAccountOwner,
    TAccountPool,
    TAccountWhitelist,
    TAccountMintProof,
    TAccountMint,
    TAccountOwnerTa,
    TAccountPoolTa,
    TAccountNftReceipt,
    TAccountTokenProgram,
    TAccountAssociatedTokenProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedDepositNftT22Instruction<
  TProgram extends string = typeof TENSOR_AMM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The owner of the pool and the NFT. */
    owner: TAccountMetas[0];
    /** The pool to deposit the NFT into. */
    pool: TAccountMetas[1];
    /** The whitelist that gatekeeps which NFTs can be deposited into the pool. */
    whitelist: TAccountMetas[2];
    mintProof: TAccountMetas[3];
    /**
     * The mint account of the NFT. It should be the mint account common
     * to the owner_ta and pool_ta.
     */

    mint: TAccountMetas[4];
    /** The TA of the owner, where the NFT will be transferred from. */
    ownerTa: TAccountMetas[5];
    /** The TA of the pool, where the NFT will be escrowed. */
    poolTa: TAccountMetas[6];
    /** The NFT receipt account denoting that an NFT has been deposited into this pool. */
    nftReceipt: TAccountMetas[7];
    /** The SPL Token program for the Mint and ATAs. */
    tokenProgram: TAccountMetas[8];
    /** The SPL associated token program. */
    associatedTokenProgram: TAccountMetas[9];
    /** The Solana system program. */
    systemProgram: TAccountMetas[10];
  };
  data: DepositNftT22InstructionData;
};

export function parseDepositNftT22Instruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedDepositNftT22Instruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 11) {
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
      pool: getNextAccount(),
      whitelist: getNextAccount(),
      mintProof: getNextAccount(),
      mint: getNextAccount(),
      ownerTa: getNextAccount(),
      poolTa: getNextAccount(),
      nftReceipt: getNextAccount(),
      tokenProgram: getNextAccount(),
      associatedTokenProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getDepositNftT22InstructionDataDecoder().decode(instruction.data),
  };
}
