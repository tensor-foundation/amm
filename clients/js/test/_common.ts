import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { Token, fetchToken } from '@solana-program/token';
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
  getDepositMarginAccountInstruction,
  getInitMarginAccountInstruction,
  getInitUpdateTswapInstruction,
} from '@tensor-foundation/escrow';
import {
  Nft,
  TokenStandard,
  createDefaultNftInCollection,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
import { findFeeVaultPda } from '@tensor-foundation/resolvers';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  Client,
  T22NftReturn,
  TOKEN22_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createKeyPairSigner,
  createT22NftWithRoyalties,
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
  fetchPool,
  findNftDepositReceiptPda,
  findPoolPda,
  getCreatePoolInstruction,
  getDepositNftInstructionAsync,
  getDepositNftT22InstructionAsync,
  getDepositSolInstruction,
} from '../src/index.js';
import { generateTreeOfSize } from './_merkle.js';

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

export const DEFAULT_PUBKEY: Address = address(
  '11111111111111111111111111111111'
);
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const DEFAULT_DELTA = 10_000_000n;
export const ONE_WEEK = 60 * 60 * 24 * 7;
export const ONE_YEAR = 60 * 60 * 24 * 365;

export const ZERO_ACCOUNT_RENT_LAMPORTS = 890880n;
export const ONE_SOL = 1_000_000_000n;

export const POOL_SIZE = 452n;

export const TAKER_FEE_BPS = 200n;
export const BROKER_FEE_PCT = 80n;
export const BASIS_POINTS = 10_000n;

export const TRANSACTION_SIGNATURE_FEE = 5_000n;

export const TSWAP_SINGLETON: Address = address(
  '4zdNGgAtFsW1cQgHqkiWyRsxaAgxrSRRynnuunxzjxue'
);

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
    sharedEscrow: sharedEscrow ? some(sharedEscrow) : none(),
    makerBroker: makerBroker ? some(makerBroker) : none(),
    orderType: 0,
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
    sharedEscrow: sharedEscrow ? some(sharedEscrow) : none(),
    orderType: 0,
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
> & { owner?: KeyPairSigner };

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
    buffer.slice(TOKEN_OWNER_START_INDEX, TOKEN_OWNER_END_INDEX)
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

export interface T22Test {
  client: Client;
  signers: TestSigners;
  nft: T22NftReturn & { sellerFeeBasisPoints: bigint };
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  mintProof: Address;
  sharedEscrow: Address | undefined;
}

export interface LegacyTest {
  client: Client;
  signers: TestSigners;
  nft: Nft;
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  sharedEscrow: Address | undefined;
}

export interface TestConfig {
  poolConfig: PoolConfig;
  depositAmount: bigint;
  price: bigint;
}

export interface SetupTestParams {
  t: ExecutionContext;
  poolType: PoolType;
  action: TestAction;
  whitelistMode?: Mode;
  depositAmount?: bigint;
  useSharedEscrow?: boolean;
  useCosigner?: boolean;
  compoundFees?: boolean;
  fundPool?: boolean;
}

export enum TestAction {
  Buy,
  Sell,
}

export async function setupLegacyTest(
  params: SetupTestParams & {
    pNft?: boolean;
    signerFunds?: bigint;
    poolConfig?: PoolConfig | null;
  }
): Promise<LegacyTest> {
  const {
    t,
    poolType,
    action,
    whitelistMode = Mode.FVC,
    depositAmount: dA,
    pNft = false,
    useSharedEscrow = false,
    useCosigner = false,
    compoundFees = false,
    fundPool = true,
    signerFunds = 5n * ONE_SOL,
    poolConfig,
  } = params;

  const client = createDefaultSolanaClient();
  const testSigners = await getTestSigners(client, signerFunds);

  const { payer, poolOwner, nftUpdateAuthority, cosigner, makerBroker } =
    testSigners;

  let { nftOwner } = testSigners;

  // When buying, we mint the NFT to the poolOwner which then deposits it into the
  // pool so it can be purchased by the buyer.
  if (action == TestAction.Buy) {
    nftOwner = poolOwner;
  }

  // Mint NFT
  const { collection, item: nft } = await createDefaultNftInCollection({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner,
    standard: pNft
      ? TokenStandard.ProgrammableNonFungible
      : TokenStandard.NonFungible,
  });

  // Reset test timeout for long-running tests.
  t.pass();

  const { mint, token: ownerAta } = nft;

  let config: PoolConfig;
  let price: bigint;
  let mmFees = 0n;

  let startingPrice;
  if (!poolConfig) {
    switch (poolType) {
      case PoolType.Trade:
        config = { ...tradePoolConfig, mmCompoundFees: compoundFees };
        // Sells on trade pools need to to have the price shifted down by 1 step.
        if (action === TestAction.Sell) {
          startingPrice = config.startingPrice - config.delta;
        } else {
          startingPrice = config.startingPrice;
        }
        mmFees = (startingPrice * BigInt(config.mmFeeBps ?? 0)) / BASIS_POINTS;
        break;
      case PoolType.Token:
        config = tokenPoolConfig;
        startingPrice = config.startingPrice;
        break;
      case PoolType.NFT:
        config = nftPoolConfig;
        startingPrice = config.startingPrice;
        break;
      default:
        throw new Error('Invalid pool type');
    }
  } else {
    config = poolConfig;
    startingPrice = poolConfig.startingPrice;
  }

  const md = (await fetchMetadata(client.rpc, nft.metadata)).data;
  const { sellerFeeBasisPoints } = md;

  const royalties =
    (startingPrice * BigInt(sellerFeeBasisPoints)) / BASIS_POINTS;

  const depositAmount = dA ?? config.startingPrice * 10n;

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: nftOwner.address,
      amount: 1n,
    },
  });

  let sharedEscrow: Address | undefined;

  if (useSharedEscrow) {
    // Create a shared escrow account.
    sharedEscrow = await createAndFundEscrow(client, poolOwner, 1);
  }

  let conditions: Condition[] = [];
  let mintProof: Address | undefined;
  let proof;

  switch (whitelistMode) {
    case Mode.FVC:
      conditions = [{ mode: Mode.FVC, value: nftUpdateAuthority.address }];
      break;
    case Mode.VOC:
      conditions = [{ mode: Mode.VOC, value: collection.mint }];
      break;
    case Mode.MerkleTree: {
      // Setup a merkle tree with our mint as a leaf
      const {
        root,
        proofs: [p],
      } = await generateTreeOfSize(10, [mint]);
      proof = p;
      conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];
      break;
    }
    default:
      throw new Error('Invalid whitelist mode');
  }

  // Create a whitelist and a funded pool.
  const { whitelist, pool } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    cosigner: useCosigner ? cosigner : undefined,
    sharedEscrow,
    config,
    depositAmount,
    conditions,
    funded: sharedEscrow ? false : fundPool, // Shared Escrow pools can't be funded directly.
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === poolType);
  t.assert(
    poolAccount.data.config.mmFeeBps ===
      (poolType === PoolType.Trade ? config.mmFeeBps : null)
  );

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  switch (action) {
    case TestAction.Buy: {
      // Max price needs to account for royalties and mm fees.
      price = startingPrice + royalties + mmFees;

      if (whitelistMode === Mode.MerkleTree) {
        // Create the mint proof for the whitelist.
        const mp = await upsertMintProof({
          client,
          payer,
          mint,
          whitelist,
          proof: proof!.proof,
        });
        mintProof = mp.mintProof;
      }

      // Deposit the NFT into the pool so it can be bought.
      const depositNftIx = await getDepositNftInstructionAsync({
        owner: nftOwner, // Same as poolOwner for Buy action
        pool,
        whitelist,
        mint,
        mintProof,
        tokenStandard: pNft
          ? TokenStandard.ProgrammableNonFungible
          : TokenStandard.NonFungible,
      });

      await pipe(
        await createDefaultTransaction(client, poolOwner),
        (tx) =>
          appendTransactionMessageInstruction(
            getSetComputeUnitLimitInstruction({ units: 400_000 }),
            tx
          ),
        (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      await assertTokenNftOwnedBy({
        t,
        client,
        mint,
        owner: pool,
      });

      // Deposit Receipt should be created
      await assertNftReceiptCreated({ t, client, pool, mint });

      break;
    }
    case TestAction.Sell:
      // Min price needs to account for royalties and mm fees.
      price = startingPrice - royalties - mmFees;
      break;
    default:
      throw new Error('Invalid action');
  }

  return {
    client,
    signers: testSigners,
    nft,
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
    },
    whitelist,
    pool,
    feeVault,
    sharedEscrow,
  };
}

export async function setupT22Test(params: SetupTestParams): Promise<T22Test> {
  const {
    t,
    poolType,
    action,
    depositAmount: dA,
    useSharedEscrow = false,
    useCosigner = false,
    compoundFees = false,
    fundPool = true,
  } = params;

  const client = createDefaultSolanaClient();

  const testSigners = await getTestSigners(client);

  const { payer, poolOwner, nftUpdateAuthority, cosigner, makerBroker } =
    testSigners;

  let { nftOwner } = testSigners;

  // When buying, we mint the NFT to the poolOwner which then deposits it into the
  // pool so it can be purchased by the buyer.
  if (action == TestAction.Buy) {
    nftOwner = poolOwner;
  }

  const royaltyDestinationString = '_ro_' + nftUpdateAuthority.address;
  const sellerFeeBasisPoints = 500n;

  // Mint NFT
  const t22Nft = await createT22NftWithRoyalties({
    client,
    payer: nftOwner,
    owner: nftOwner.address,
    mintAuthority: nftUpdateAuthority,
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
    royalties: {
      key: royaltyDestinationString,
      value: sellerFeeBasisPoints.toString(),
    },
  });

  const { mint, ownerAta, extraAccountMetas } = t22Nft;

  let config: PoolConfig;
  let price: bigint;
  let mmFees = 0n;
  let startingPrice;

  switch (poolType) {
    case PoolType.Trade:
      config = { ...tradePoolConfig, mmCompoundFees: compoundFees };
      // Sells on trade pools need to to have the price shifted down by 1 step.
      if (action === TestAction.Sell) {
        startingPrice = config.startingPrice - config.delta;
      } else {
        startingPrice = config.startingPrice;
      }
      mmFees = (startingPrice * BigInt(config.mmFeeBps ?? 0)) / BASIS_POINTS;
      break;
    case PoolType.Token:
      config = tokenPoolConfig;
      startingPrice = config.startingPrice;
      break;
    case PoolType.NFT:
      config = nftPoolConfig;
      startingPrice = config.startingPrice;
      break;
    default:
      throw new Error('Invalid pool type');
  }

  const royalties = (startingPrice * sellerFeeBasisPoints) / BASIS_POINTS;
  const depositAmount = dA ?? startingPrice * 10n;

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: nftOwner.address,
      amount: 1n,
    },
  });

  let sharedEscrow: Address | undefined;

  if (useSharedEscrow) {
    // Create a shared escrow account.
    sharedEscrow = await createAndFundEscrow(client, poolOwner, 1);
  }

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

  // Create a whitelist and a funded pool.
  const { whitelist, pool } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    cosigner: useCosigner ? cosigner : undefined,
    sharedEscrow,
    config,
    depositAmount,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
    funded: sharedEscrow ? false : fundPool, // Shared Escrow pools can't be funded directly.
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === poolType);
  t.assert(
    poolAccount.data.config.mmFeeBps ===
      (poolType === PoolType.Trade ? config.mmFeeBps : null)
  );

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer,
    mint,
    whitelist,
    proof: p.proof,
  });

  switch (action) {
    case TestAction.Buy: {
      // Max price needs to account for royalties and mm fees.
      price = startingPrice + royalties + mmFees;

      // Deposit the NFT into the pool so it can be bought.
      const depositNftIx = await getDepositNftT22InstructionAsync({
        owner: nftOwner, // Same as poolOwner for Buy action
        pool,
        whitelist,
        mint,
        mintProof,
        tokenProgram: TOKEN22_PROGRAM_ID,
        transferHookAccounts: extraAccountMetas.map((a) => a.address),
      });

      await pipe(
        await createDefaultTransaction(client, poolOwner),
        (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      await assertTokenNftOwnedBy({
        t,
        client,
        mint,
        owner: pool,
        tokenProgramAddress: TOKEN22_PROGRAM_ID,
      });

      // Deposit Receipt should be created
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

      break;
    }
    case TestAction.Sell:
      // Min price needs to account for royalties and mm fees.
      price = startingPrice - royalties - mmFees;
      break;
    default:
      throw new Error('Invalid action');
  }

  return {
    client,
    signers: testSigners,
    nft: { ...t22Nft, sellerFeeBasisPoints },
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
    },
    whitelist,
    pool,
    feeVault,
    mintProof,
    sharedEscrow,
  };
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
