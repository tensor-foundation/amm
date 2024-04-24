import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { KeyPairSigner, generateKeyPairSigner } from '@solana/signers';
import {
  Address,
  Base64EncodedDataResponse,
  ProgramDerivedAddress,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  Signature,
  address,
  airdropFactory,
  appendTransactionInstruction,
  getAddressEncoder,
  getProgramDerivedAddress,
  getStringEncoder,
  getU8Encoder,
  isSolanaError,
  lamports,
  none,
  pipe,
  some,
} from '@solana/web3.js';
import '@solana/webcrypto-ed25519-polyfill';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  Client,
  MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  SYSVARS_INSTRUCTIONS,
  TOKEN_PROGRAM_ID,
  TSWAP_PROGRAM_ID,
  createDefaultTransaction,
  createKeyPairSigner,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import {
  Condition,
  Mode,
  findWhitelistV2Pda,
  getCreateWhitelistV2Instruction,
} from '@tensor-foundation/whitelist';
import {
  getInitMarginAccountInstruction,
  findMarginAccountPda,
  getDepositMarginAccountInstruction,
  getInitUpdateTswapInstruction,
} from '@tensor-foundation/escrow';
import { ExecutionContext } from 'ava';
import bs58 from 'bs58';
import { v4 } from 'uuid';
import {
  AMM_PROGRAM_ADDRESS,
  CurveType,
  PoolConfig,
  PoolType,
  findNftDepositReceiptPda,
  findPoolPda,
  getCreatePoolInstruction,
  getDepositSolInstruction,
  getSellNftTradePoolInstruction,
} from '../src/index.js';

const OWNER_BYTES = [
  75, 111, 93, 80, 59, 171, 168, 79, 238, 255, 9, 233, 236, 194, 196, 73, 76, 2,
  51, 180, 184, 6, 77, 52, 36, 243, 28, 125, 104, 104, 114, 246, 166, 110, 5,
  17, 12, 8, 199, 21, 64, 143, 53, 202, 39, 71, 93, 114, 119, 171, 152, 44, 155,
  146, 43, 217, 148, 215, 83, 14, 162, 91, 65, 177,
];

export const getOwner = async () =>
  await createKeyPairSigner(Uint8Array.from(OWNER_BYTES));

export const getAndFundOwner = async (client: Client) => {
  const owner = await createKeyPairSigner(Uint8Array.from(OWNER_BYTES));
  await airdropFactory(client)({
    recipientAddress: owner.address,
    lamports: lamports(ONE_SOL),
    commitment: 'confirmed',
  });

  return owner;
};

export const DEFAULT_PUBKEY: Address = address(
  '11111111111111111111111111111111'
);
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const DEFAULT_DELTA = 1000n;
export const ONE_WEEK = 60 * 60 * 24 * 7;
export const ONE_YEAR = 60 * 60 * 24 * 365;

export const ZERO_ACCOUNT_RENT_LAMPORTS = 890880n;
export const ONE_SOL = 1_000_000_000n;

export const MAKER_REBATE_BPS = 25n;

export const BASIS_POINTS = 10_000n;

export const TSWAP_SINGLETON: Address = address(
  '4zdNGgAtFsW1cQgHqkiWyRsxaAgxrSRRynnuunxzjxue'
);

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AtaSeeds = {
  /** The address of the owner of the associated token account */
  owner: Address;
  /** The address of the mint account */
  mint: Address;
  /** The address of the token program */
  tokenProgramId?: Address;
};

export const findAtaPda = async (
  seeds: AtaSeeds
): Promise<ProgramDerivedAddress> => {
  return await getProgramDerivedAddress({
    seeds: [
      getAddressEncoder().encode(seeds.owner),
      getAddressEncoder().encode(seeds.tokenProgramId ?? TOKEN_PROGRAM_ID),
      getAddressEncoder().encode(seeds.mint),
    ],
    programAddress: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  });
};

export const tradePoolConfig: PoolConfig = {
  poolType: PoolType.Trade,
  curveType: CurveType.Linear,
  startingPrice: LAMPORTS_PER_SOL,
  delta: DEFAULT_DELTA,
  mmCompoundFees: true,
  mmFeeBps: null,
};

export interface CreateWhitelistParams {
  client: Client;
  payer?: KeyPairSigner;
  updateAuthority: KeyPairSigner;
  namespace?: KeyPairSigner;
  freezeAuthority?: Address;
  conditions?: Condition[];
}

export interface CreateWhitelistThrowsParams extends CreateWhitelistParams {
  t: ExecutionContext;
  message: RegExp;
}

export interface CreateWhitelistReturns {
  whitelist: Address;
  uuid: Uint8Array;
  conditions: Condition[];
}

export async function createWhitelistV2({
  client,
  updateAuthority,
  payer = updateAuthority,
  namespace,
  freezeAuthority = DEFAULT_PUBKEY,
  conditions = [{ mode: Mode.FVC, value: updateAuthority.address }],
}: CreateWhitelistParams): Promise<CreateWhitelistReturns> {
  const uuid = generateUuid();
  namespace = namespace || (await generateKeyPairSigner());

  const [whitelist] = await findWhitelistV2Pda({
    namespace: namespace.address,
    uuid,
  });

  const createWhitelistIx = getCreateWhitelistV2Instruction({
    payer,
    updateAuthority,
    namespace,
    whitelist,
    freezeAuthority,
    conditions,
    uuid,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionInstruction(createWhitelistIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { whitelist, uuid, conditions };
}

export const generateUuid = () => uuidToUint8Array(v4());

export const uuidToUint8Array = (uuid: string) => {
  const encoder = new TextEncoder();
  // replace any '-' to handle uuids
  return encoder.encode(uuid.replaceAll('-', ''));
};

export const nameToUint8Array = (name: string) => {
  const encoder = new TextEncoder();
  const encodedName = encoder.encode(name);
  const paddedName = new Uint8Array(32);
  paddedName.set(encodedName);
  return paddedName;
};

export interface CreatePoolParams {
  client: Client;
  whitelist: Address;
  owner: KeyPairSigner;
  payer?: KeyPairSigner;
  cosigner?: KeyPairSigner;
  poolId?: Uint8Array;
  config?: PoolConfig;
  expireInSec?: number;
}

export interface CreatePoolThrowsParams extends CreatePoolParams {
  t: ExecutionContext;
  code: number;
}

export interface CreatePoolReturns {
  pool: Address;
  owner: KeyPairSigner;
  cosigner: KeyPairSigner | undefined;
  poolId: Uint8Array;
  whitelist: Address;
}

export async function createPool({
  client,
  whitelist,
  owner,
  payer = owner,
  cosigner,
  poolId,
  config,
  expireInSec,
}: CreatePoolParams): Promise<CreatePoolReturns> {
  // Pool values

  if (poolId === undefined) {
    poolId = Uint8Array.from({ length: 32 }, () => 1);
  }

  if (config === undefined) {
    config = {
      poolType: PoolType.Token,
      curveType: CurveType.Linear,
      startingPrice: 1n,
      delta: 1n,
      mmCompoundFees: false,
      mmFeeBps: null,
    };
  }

  const [pool] = await findPoolPda({
    owner: owner.address,
    poolId,
  });

  // When we create a new account.
  const createPoolIx = getCreatePoolInstruction({
    rentPayer: payer,
    owner,
    pool,
    whitelist,
    poolId,
    currency: DEFAULT_PUBKEY,
    config,
    maxTakerSellCount: 0,
    cosigner: cosigner ? some(cosigner.address) : none(),
    orderType: 0,
    expireInSec: expireInSec ?? null,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(createPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { pool, owner, cosigner, poolId, whitelist };
}

export async function createPoolThrows({
  client,
  whitelist,
  owner,
  payer = owner,
  cosigner,
  poolId,
  config,
  t,
  code,
}: CreatePoolThrowsParams) {
  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (cosigner === undefined) {
    cosigner = await generateKeyPairSigner();
  }
  if (poolId === undefined) {
    poolId = Uint8Array.from({ length: 32 }, () => 1);
  }

  if (config === undefined) {
    config = {
      poolType: PoolType.Trade,
      curveType: CurveType.Linear,
      startingPrice: 1n,
      delta: 1n,
      mmCompoundFees: false,
      mmFeeBps: null,
    };
  }

  const [pool] = await findPoolPda({
    owner: owner.address,
    poolId,
  });

  // When we create a new account.
  const createPoolIx = getCreatePoolInstruction({
    rentPayer: payer,
    owner,
    pool,
    whitelist,
    poolId,
    currency: DEFAULT_PUBKEY,
    config,
    maxTakerSellCount: 0,
    cosigner: some(cosigner.address),
    orderType: 0,
    expireInSec: null,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(createPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
}

// Turn owner into an optional param.
type CreatePoolAndWhitelistParams = Omit<
  CreatePoolParams,
  'whitelist' | 'owner'
> & { owner?: KeyPairSigner; depositAmount?: bigint; conditions?: Condition[] };
type CreatePoolAndWhitelistThrowsParams = Omit<
  CreatePoolThrowsParams,
  'whitelist' | 'owner'
> & { owner?: KeyPairSigner };

export async function createPoolAndWhitelist({
  client,
  owner,
  payer = owner,
  cosigner,
  poolId,
  config,
  depositAmount = 1_000_000n,
  conditions,
}: CreatePoolAndWhitelistParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();

  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (cosigner === undefined) {
    cosigner = await generateKeyPairSigner();
  }
  if (poolId === undefined) {
    poolId = Uint8Array.from({ length: 32 }, () => 1);
  }
  if (conditions === undefined) {
    conditions = [{ mode: Mode.FVC, value: updateAuthority.address }];
  }

  // Setup a basic whitelist to use with the pool.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority,
    conditions,
    namespace,
  });

  const { pool } = await createPool({
    client,
    whitelist,
    payer,
    owner,
    cosigner,
    poolId,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { pool, owner, cosigner, poolId, whitelist };
}

export async function createPoolAndWhitelistThrows({
  client,

  owner,
  cosigner,
  poolId,
  config,
  t,
  code,
}: CreatePoolAndWhitelistThrowsParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
  ];

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority,
    conditions,
    namespace,
  });

  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (cosigner === undefined) {
    cosigner = await generateKeyPairSigner();
  }
  if (poolId === undefined) {
    poolId = Uint8Array.from({ length: 32 }, () => 1);
  }

  return await createPoolThrows({
    client,
    whitelist,
    owner,
    cosigner,
    poolId,
    config,
    t,
    code,
  });
}

const TOKEN_OWNER_START_INDEX = 32;
const TOKEN_OWNER_END_INDEX = 64;
const TOKEN_AMOUNT_START_INDEX = 64;

export function getTokenAmount(data: Base64EncodedDataResponse): BigInt {
  const buffer = Buffer.from(String(data), 'base64');
  return buffer.readBigUInt64LE(TOKEN_AMOUNT_START_INDEX);
}

export function getTokenOwner(data: Base64EncodedDataResponse): Address {
  const buffer = Buffer.from(String(data), 'base64');
  const base58string = bs58.encode(
    buffer.slice(TOKEN_OWNER_START_INDEX, TOKEN_OWNER_END_INDEX)
  );
  return address(base58string);
}

export type MintAndSellParams = {
  client: Client;
  pool: Address;
  whitelist: Address;
  poolOwner: KeyPairSigner;
  nftOwner: KeyPairSigner;
};

export type MintAndSellReturn = {
  mint: Address;
  feeVault: Address;
  index: number;
  bump: number;
};

export async function mintAndSellIntoPool({
  client,
  pool,
  whitelist,
  poolOwner,
  nftOwner,
}: MintAndSellParams) {
  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Last byte of mint address is the fee vault shard number.
  const mintBytes = bs58.decode(mint);
  const lastByte = mintBytes[mintBytes.length - 1];

  const [feeVault, bump] = await getProgramDerivedAddress({
    programAddress: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),
    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),
      getU8Encoder().encode(lastByte),
    ],
  });

  const feeVaultBalance = (await client.rpc.getBalance(feeVault).send()).value;

  if (feeVaultBalance === 0n) {
    // Fund fee vault with min rent lamports.
    await airdropFactory(client)({
      recipientAddress: feeVault,
      lamports: lamports(890880n),
      commitment: 'confirmed',
    });
  }

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const minPrice = 900_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    owner: poolOwner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    sellerTokenRecord,
    poolTokenRecord,
    nftReceipt,
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: poolOwner.address, // No taker broker so we put a dummy here for now
    minPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  return { mint, feeVault, shard: lastByte, bump };
}

export const assertTammNoop = async (
  t: ExecutionContext,
  client: Client,
  sig: Signature
) => {
  const tx = await client.rpc
    .getTransaction(sig, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    .send();

  t.assert(
    tx?.meta?.logMessages?.some((msg) => msg.includes('Instruction: TammNoop'))
  );
};

// Derives fee vault from mint and airdrops keep-alive rent to it.
export const getAndFundFeeVault = async (client: Client, mint: Address) => {
  // Last byte of mint address is the fee vault shard number.
  const mintBytes = bs58.decode(mint);
  const lastByte = mintBytes[mintBytes.length - 1];

  const [feeVault] = await getProgramDerivedAddress({
    programAddress: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),
    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),
      getU8Encoder().encode(lastByte),
    ],
  });

  // Fund fee vault with min rent lamports.
  await airdropFactory(client)({
    recipientAddress: feeVault,
    lamports: lamports(890880n),
    commitment: 'confirmed',
  });

  return feeVault;
};

export const createAndFundEscrow = async (
  client: Client,
  owner: KeyPairSigner,
  feeVault: Address,
  marginNr: number
) => {
  const tswapOwner = await getAndFundOwner(client);

  const tswap = TSWAP_SINGLETON;
  const nr = new Uint8Array(2);
  nr[0] = marginNr & 0xff;
  nr[1] = (marginNr >> 8) & 0xff;

  const [marginAccount] = await findMarginAccountPda({
    owner: owner.address,
    tswap,
    marginNr: nr,
  });

  const initTswapIx = getInitUpdateTswapInstruction({
    tswap,
    owner: tswapOwner,
    newOwner: tswapOwner,
    feeVault,
    cosigner: tswapOwner,
    config: { feeBps: 0 },
  });

  const createEscrowIx = getInitMarginAccountInstruction({
    owner,
    tswap,
    marginAccount,
    marginNr,
    name: Uint8Array.from([]),
  });

  const depositEscrowIx = getDepositMarginAccountInstruction({
    owner,
    tswap,
    marginAccount,
    lamports: 1_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(initTswapIx, tx),
    (tx) => appendTransactionInstruction(createEscrowIx, tx),
    (tx) => appendTransactionInstruction(depositEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return marginAccount;
};
