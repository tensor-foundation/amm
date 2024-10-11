import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Account,
  Address,
  Base64EncodedDataResponse,
  KeyPairSigner,
  ProgramDerivedAddress,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  Signature,
  address,
  airdropFactory,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  isSolanaError,
  lamports,
  none,
  pipe,
  some,
} from '@solana/web3.js';
import {
  findMarginAccountPda,
  findTSwapPda,
  getDepositMarginAccountInstruction,
  getInitMarginAccountInstruction,
  getInitUpdateTswapInstruction,
} from '@tensor-foundation/escrow';
import { Creator } from '@tensor-foundation/mpl-token-metadata';
import { findFeeVaultPda } from '@tensor-foundation/resolvers';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  Client,
  TOKEN_PROGRAM_ID,
  createDefaultTransaction,
  createKeyPairSigner,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Condition,
  Mode,
  findMintProofV2Pda,
  findWhitelistV2Pda,
  getCreateWhitelistV2Instruction,
  getInitUpdateMintProofV2InstructionAsync,
  intoAddress,
} from '@tensor-foundation/whitelist';
import { ExecutionContext } from 'ava';
import bs58 from 'bs58';
import { v4 } from 'uuid';
import {
  CurveType,
  NftDepositReceipt,
  PoolConfig,
  PoolType,
  fetchMaybeNftDepositReceipt,
  fetchNftDepositReceipt,
  findNftDepositReceiptPda,
  findPoolPda,
  getCreatePoolInstruction,
  getDepositSolInstruction,
} from '../src/index.js';
import { generateTreeOfSize } from './_merkle.js';

export const COMPUTE_300K_IX = (() => {
  return getSetComputeUnitLimitInstruction({
    units: 300_000,
  });
})();

export const COMPUTE_500K_IX = (() => {
  return getSetComputeUnitLimitInstruction({
    units: 500_000,
  });
})();

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

export const ANCHOR_ERROR__CONSTRAINT_SEEDS = 2006;
export const ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED = 3012;
export const VIPER_ERROR__INTEGER_OVERFLOW = 1103;

export const DEFAULT_PUBKEY: Address = address(
  '11111111111111111111111111111111'
);
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const DEFAULT_DELTA = 10_000_000n;
export const ONE_WEEK = 60 * 60 * 24 * 7;
export const ONE_YEAR = 60 * 60 * 24 * 365;

export const ZERO_ACCOUNT_RENT_LAMPORTS = 890880n;
export const ONE_SOL = 1_000_000_000n;

export const POOL_SIZE = 447n;

export const CURRENT_POOL_VERSION = 1;

export const TAKER_FEE_BPS = 200n;
export const BROKER_FEE_PCT = 50n;
export const BASIS_POINTS = 10_000n;
export const HUNDRED_PERCENT = 100n;
export const MAKER_BROKER_FEE_PCT = 80n;
export const TRANSACTION_SIGNATURE_FEE = 5_000n;

export const TSWAP_SINGLETON: Address = address(
  '4zdNGgAtFsW1cQgHqkiWyRsxaAgxrSRRynnuunxzjxue'
);

export const TENSOR_ERROR__BAD_ROYALTIES_PCT = 15001;
export const TENSOR_ERROR__INSUFFICIENT_BALANCE = 15002;
export const TENSOR_ERROR__CREATOR_MISMATCH = 15003;
export const TENSOR_ERROR__FAILED_LEAF_VERIFICATION = 15004;
export const TENSOR_ERROR__ARITHMETIC_ERROR = 15005;
export const TENSOR_ERROR__BAD_METADATA = 15006;
export const TENSOR_ERROR__BAD_RULE_SET = 15007;
export const TENSOR_ERROR__INVALID_CORE_ASSET = 15008;
export const TENSOR_ERROR__INVALID_FEE_ACCOUNT = 15009;

export interface TestSigners {
  nftOwner: KeyPairSigner;
  nftUpdateAuthority: KeyPairSigner;
  payer: KeyPairSigner;
  buyer: KeyPairSigner;
  poolOwner: KeyPairSigner;
  cosigner: KeyPairSigner;
  makerBroker: KeyPairSigner;
  takerBroker: KeyPairSigner;
}

export async function getTestSigners(
  client: Client,
  funds: bigint = 5n * ONE_SOL
) {
  // Generic payer.
  const payer = await generateKeyPairSignerWithSol(client, funds);

  // Cosigner.
  const cosigner = await generateKeyPairSigner();

  // NFT Update Authority
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client, funds);

  // Pool owner.
  const poolOwner = await generateKeyPairSignerWithSol(client, funds);

  // NFT owner and seller.
  const nftOwner = await generateKeyPairSignerWithSol(client, funds);

  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client, funds);

  const makerBroker = await generateKeyPairSignerWithSol(client);
  const takerBroker = await generateKeyPairSignerWithSol(client);

  return {
    client,
    nftOwner,
    nftUpdateAuthority,
    payer,
    buyer,
    poolOwner,
    cosigner,
    makerBroker,
    takerBroker,
  };
}

export async function getPoolStateBond(client: Client) {
  return await client.rpc.getMinimumBalanceForRentExemption(POOL_SIZE).send();
}

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
  startingPrice: 10n * DEFAULT_DELTA,
  delta: DEFAULT_DELTA,
  mmCompoundFees: false,
  mmFeeBps: 50,
};

export const tokenPoolConfig: PoolConfig = {
  ...tradePoolConfig,
  poolType: PoolType.Token,
  mmFeeBps: null,
};

export const nftPoolConfig: PoolConfig = {
  ...tradePoolConfig,
  poolType: PoolType.NFT,
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
    (tx) => appendTransactionMessageInstruction(createWhitelistIx, tx),
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
  sharedEscrow?: Address;
  makerBroker?: Address;
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
  sharedEscrow,
  makerBroker,
  poolId,
  config,
  expireInSec,
}: CreatePoolParams): Promise<CreatePoolReturns> {
  // Pool values

  if (poolId === undefined) {
    poolId = generateUuid();
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
    config,
    maxTakerSellCount: 0,
    cosigner: cosigner ? some(cosigner.address) : none(),
    sharedEscrow: sharedEscrow ?? undefined,
    makerBroker: makerBroker ? some(makerBroker) : none(),
    expireInSec: expireInSec ?? null,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(createPoolIx, tx),
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
  sharedEscrow,
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
    config,
    maxTakerSellCount: 0,
    cosigner: cosigner ? some(cosigner.address) : none(),
    sharedEscrow: sharedEscrow ?? undefined,
    expireInSec: null,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(createPoolIx, tx),
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

export async function createPoolAndFundSharedEscrow(
  params: CreatePoolParams,
  lamports: bigint
): Promise<CreatePoolReturns> {
  const { client, owner, sharedEscrow } = params;

  const tswap = (await findTSwapPda())[0];
  const tswapOwner = await getAndFundOwner(client);

  const initTswapIx = getInitUpdateTswapInstruction({
    tswap,
    owner: tswapOwner,
    newOwner: tswapOwner,
    feeVault: DEFAULT_PUBKEY, // Dummy fee vault
    cosigner: owner,
    config: { feeBps: 0 },
  });

  const createMarginAccountIx = getInitMarginAccountInstruction({
    owner,
    tswap: (await findTSwapPda())[0],
    marginAccount: sharedEscrow!,
    marginNr: 0,
    name: Uint8Array.from([]),
  });

  const depositEscrowIx = getDepositMarginAccountInstruction({
    tswap: (await findTSwapPda())[0],
    marginAccount: sharedEscrow!,
    owner,
    lamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) =>
      appendTransactionMessageInstructions(
        [initTswapIx, createMarginAccountIx, depositEscrowIx],
        tx
      ),
    (tx) => signAndSendTransaction(client, tx)
  );

  return await createPool(params);
}

// Turn owner into an optional param.
type CreatePoolAndWhitelistParams = Omit<
  CreatePoolParams,
  'whitelist' | 'owner'
> & {
  owner?: KeyPairSigner;
  depositAmount?: bigint;
  conditions?: Condition[];
  funded: boolean;
};
type CreatePoolAndWhitelistThrowsParams = Omit<
  CreatePoolThrowsParams,
  'whitelist' | 'owner'
> & {
  owner?: KeyPairSigner;
};

export async function createPoolAndWhitelist({
  client,
  owner,
  payer = owner,
  cosigner,
  sharedEscrow,
  makerBroker,
  poolId,
  config,
  depositAmount = ONE_SOL,
  conditions,
  funded,
}: CreatePoolAndWhitelistParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();

  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (poolId === undefined) {
    poolId = generateUuid();
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
    sharedEscrow,
    makerBroker,
    poolId,
    config,
  });

  if (funded && config?.poolType !== PoolType.NFT) {
    // Deposit SOL
    const depositSolIx = getDepositSolInstruction({
      pool,
      owner,
      lamports: depositAmount,
    });

    await pipe(
      await createDefaultTransaction(client, owner),
      (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  }

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
    Uint8Array.from(
      buffer.subarray(TOKEN_OWNER_START_INDEX, TOKEN_OWNER_END_INDEX)
    )
  );
  return address(base58string);
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
export const getAndFundFeeVault = async (client: Client, pool: Address) => {
  const [feeVault] = await findFeeVaultPda({ address: pool });

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
  marginNr: number
) => {
  const tswapOwner = await getAndFundOwner(client);

  const tswap = TSWAP_SINGLETON;

  const [marginAccount] = await findMarginAccountPda({
    owner: owner.address,
    tswap,
    marginNr: marginNr,
  });

  const initTswapIx = getInitUpdateTswapInstruction({
    tswap,
    owner: tswapOwner,
    newOwner: tswapOwner,
    feeVault: DEFAULT_PUBKEY, // Dummy fee vault
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
    lamports: ONE_SOL,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(initTswapIx, tx),
    (tx) => appendTransactionMessageInstruction(createEscrowIx, tx),
    (tx) => appendTransactionMessageInstruction(depositEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return marginAccount;
};

export const expectCustomError = async (
  t: ExecutionContext,
  promise: Promise<unknown>,
  code: number
) => {
  const error = await t.throwsAsync<Error & { context: { logs: string[] } }>(
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
};

export const errorLogsContain = async (
  t: ExecutionContext,
  promise: Promise<unknown>,
  msg: string
) => {
  const error = await t.throwsAsync<Error & { context: { logs: string[] } }>(
    promise
  );

  t.assert(error.context.logs.some((l) => l.includes(msg)));
};

export interface InitUpdateMintProofV2Params {
  client: Client;
  payer: KeyPairSigner;
  mint: Address;
  whitelist: Address;
  proof: Uint8Array[];
}

export interface InitUpdateMintProofV2Returns {
  mintProof: Address;
}

export async function upsertMintProof({
  client,
  payer,
  mint,
  whitelist,
  proof,
}: InitUpdateMintProofV2Params): Promise<InitUpdateMintProofV2Returns> {
  const [mintProof] = await findMintProofV2Pda({ mint, whitelist });

  const createMintProofIx = await getInitUpdateMintProofV2InstructionAsync({
    payer,
    mint,
    mintProof,
    whitelist,
    proof,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => appendTransactionMessageInstruction(createMintProofIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { mintProof };
}

export interface TestConfig {
  poolConfig: PoolConfig;
  depositAmount: bigint;
  price: bigint;
  sellerFeeBasisPoints: bigint;
}

export interface SetupTestParams {
  t: ExecutionContext;
  poolType: PoolType;
  action: TestAction;
  whitelistMode?: Mode;
  treeSize?: number;
  creators?: Creator[] & { signers?: KeyPairSigner[] };
  depositAmount?: bigint;
  useMakerBroker?: boolean;
  useSharedEscrow?: boolean;
  useCosigner?: boolean;
  compoundFees?: boolean;
  fundPool?: boolean;
}

export enum TestAction {
  Buy,
  Sell,
}

export interface NftOwnedByPoolParams {
  t: ExecutionContext;
  client: Client;
  asset: Address;
  pool: Address;
  tokenProgramId?: Address;
}

export interface TokenNftOwnedByParams {
  t: ExecutionContext;
  client: Client;
  mint: Address;
  owner: Address;
  tokenProgramAddress?: Address;
}

// Asserts that a token-based NFT is owned by a specific address by deriving
// the ATA for the owner and checking the amount and owner of the token.
export async function assertTokenNftOwnedBy(params: TokenNftOwnedByParams) {
  const {
    t,
    client,
    mint,
    owner,
    tokenProgramAddress = TOKEN_PROGRAM_ID,
  } = params;

  const [ownerAta] = await findAtaPda({
    mint,
    owner,
    tokenProgramId: tokenProgramAddress,
  });
  const ownerAtaAccount = await client.rpc
    .getAccountInfo(ownerAta, { encoding: 'base64' })
    .send();

  const data = ownerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === owner);
}

export interface DepositReceiptParams {
  t: ExecutionContext;
  client: Client;
  mint: Address;
  pool: Address;
}

// Asserts that the NFT deposit receipt for a specific pool and mint is created.
export async function assertNftReceiptCreated(params: DepositReceiptParams) {
  const { t, client, mint, pool } = params;

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    Account<NftDepositReceipt, Address>
  >{
    address: nftReceipt,
    data: {
      mint,
      pool,
    },
  });
}

// Asserts that the NFT deposit receipt for a specific pool and mint is closed.
export async function assertNftReceiptClosed(params: DepositReceiptParams) {
  const { t, client, mint, pool } = params;

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);
}

export async function createProofWhitelist(
  client: Client,
  updateAuthority: KeyPairSigner,
  assets: Address[],
  treeSize: number
) {
  // Setup a merkle tree with our assets as leaves
  const { root, proofs } = await generateTreeOfSize(treeSize, assets);

  const namespace = await generateKeyPairSigner();

  const conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority,
    conditions,
    namespace,
  });

  return { whitelist, proofs };
}
