import '@solana/webcrypto-ed25519-polyfill';
import { ExecutionContext } from 'ava';
import bs58 from 'bs58';
import {
  Condition,
  Mode,
  findWhitelistV2Pda,
  getCreateWhitelistV2Instruction,
} from '@tensor-foundation/whitelist';
import { v4 } from 'uuid';
import {
  Address,
  pipe,
  appendTransactionInstruction,
  address,
  none,
  some,
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  ProgramDerivedAddress,
  getProgramDerivedAddress,
  getAddressEncoder,
  Base64EncodedDataResponse,
} from '@solana/web3.js';
import { KeyPairSigner, generateKeyPairSigner } from '@solana/signers';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  Client,
  TOKEN_PROGRAM_ID,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  CurveType,
  PoolConfig,
  PoolType,
  findPoolPda,
  getCreatePoolInstruction,
} from '../src/index.js';

export const DEFAULT_PUBKEY: Address = address(
  '11111111111111111111111111111111'
);
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const DEFAULT_DELTA = 1000n;
export const ONE_WEEK = 60 * 60 * 24 * 7;
export const ONE_YEAR = 60 * 60 * 24 * 365;

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
  mmFeeBps: none(),
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
    await createDefaultTransaction(client, payer.address),
    (tx) => appendTransactionInstruction(createWhitelistIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { whitelist, uuid, conditions };
}

// export const createFvcWhitelist = async (fvc: Address) => {
//   const client = createDefaultSolanaClient();
//   const { cosigner } = await setupSigners(client);

//   const uuid = uuidToUint8Array(v4());
//   const name = nameToUint8Array('test whitelist');

//   const [whitelist] = await findWhitelistPda({ uuid });

//   const createWhitelistIx = await getInitUpdateWhitelistInstructionAsync({
//     whitelist,
//     cosigner,
//     uuid,
//     name,
//     fvc,
//     rootHash: none(),
//     voc: none(),
//   });

//   await pipe(
//     await createDefaultTransaction(client, cosigner.address),
//     (tx) => appendTransactionInstruction(createWhitelistIx, tx),
//     (tx) => signAndSendTransaction(client, tx)
//   );

//   return { fvc, whitelist, uuid, name };
// };

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
      mmFeeBps: none(),
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
    currencyMint: DEFAULT_PUBKEY,
    config,
    maxTakerSellCount: 0,
    cosigner: cosigner ? some(cosigner.address) : none(),
    orderType: 0,
    expireInSec: expireInSec ?? null,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
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
      mmFeeBps: none(),
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
    currencyMint: DEFAULT_PUBKEY,
    config,
    maxTakerSellCount: 0,
    cosigner: some(cosigner.address),
    orderType: 0,
    expireInSec: null,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner.address),
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
> & { owner?: KeyPairSigner };
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
}: CreatePoolAndWhitelistParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

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

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: Mode.FVC, value: owner.address },
    { mode: Mode.VOC, value: voc },
  ];

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority,
    conditions,
    namespace,
  });

  return await createPool({
    client,
    whitelist,
    payer,
    owner,
    cosigner,
    poolId,
    config,
  });
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
