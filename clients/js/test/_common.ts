/* eslint-disable import/no-extraneous-dependencies */
import '@solana/webcrypto-ed25519-polyfill';
import { ExecutionContext } from 'ava';
import {
  findWhitelistPda,
  getInitUpdateWhitelistInstructionAsync,
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
} from '@solana/web3.js';
import { KeyPairSigner, generateKeyPairSigner } from '@solana/signers';
import {
  Client,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  CurveType,
  PoolConfig,
  PoolType,
  findPoolPda,
  findSolEscrowPda,
  getCreatePoolInstruction,
} from '../src';
import { setupSigners } from './_setup';

export const DEFAULT_PUBKEY: Address = address(
  '11111111111111111111111111111111'
);
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const DEFAULT_DELTA = 1000n;

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
  owner?: KeyPairSigner;
  cosigner?: KeyPairSigner;
  identifier?: Uint8Array;
  config?: PoolConfig;
}

export interface CreatePoolThrowsParams extends CreatePoolParams {
  t: ExecutionContext;
  message: RegExp;
}

export interface CreatePoolReturns {
  pool: Address;
  solEscrow: Address;
  owner: KeyPairSigner;
  cosigner: KeyPairSigner;
  identifier: Uint8Array;
  whitelist: Address;
}

export async function createPool({
  client,
  whitelist,
  owner,
  cosigner,
  identifier,
  config,
}: CreatePoolParams): Promise<CreatePoolReturns> {
  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (cosigner === undefined) {
    cosigner = await generateKeyPairSigner();
  }
  if (identifier === undefined) {
    identifier = Uint8Array.from({ length: 32 }, () => 1);
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

  const [pool, poolBump] = await findPoolPda({
    owner: owner.address,
    identifier,
  });
  const [solEscrow, solEscrowBump] = await findSolEscrowPda({ pool });

  // When we create a new account.
  const createPoolIx = getCreatePoolInstruction({
    owner,
    pool,
    solEscrow,
    whitelist,
    identifier,
    config,
    maxTakerSellCount: 0,
    cosigner: some(cosigner.address),
    orderType: 0,
    expirationTimestamp: null,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(createPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { pool, solEscrow, owner, cosigner, identifier, whitelist };
}

export async function createPoolThrows({
  client,
  whitelist,
  owner,
  cosigner,
  identifier,
  config,
  t,
  message,
}: CreatePoolThrowsParams) {
  // Pool values
  if (owner === undefined) {
    owner = await generateKeyPairSignerWithSol(client);
  }
  if (cosigner === undefined) {
    cosigner = await generateKeyPairSigner();
  }
  if (identifier === undefined) {
    identifier = Uint8Array.from({ length: 32 }, () => 1);
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

  const [pool, poolBump] = await findPoolPda({
    owner: owner.address,
    identifier,
  });
  const [solEscrow, solEscrowBump] = await findSolEscrowPda({ pool });

  // When we create a new account.
  const createPoolIx = getCreatePoolInstruction({
    owner,
    pool,
    solEscrow,
    whitelist,
    identifier,
    config,
    maxTakerSellCount: 0,
    cosigner: some(cosigner.address),
    orderType: 0,
    expirationTimestamp: null,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(createPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await t.throwsAsync(promise, { message });
}

type CreatePoolAndWhitelistParams = Omit<CreatePoolParams, 'whitelist'>;
type CreatePoolAndWhitelistThrowsParams = Omit<
  CreatePoolThrowsParams,
  'whitelist'
>;

export async function createPoolAndWhitelist({
  client,
  owner,
  cosigner,
  identifier,
  config,
}: CreatePoolAndWhitelistParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
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
  if (identifier === undefined) {
    identifier = Uint8Array.from({ length: 32 }, () => 1);
  }

  return createPool({ client, whitelist, owner, cosigner, identifier, config });
}

export async function createPoolAndWhitelistThrows({
  client,
  owner,
  cosigner,
  identifier,
  config,
  t,
  message,
}: CreatePoolAndWhitelistThrowsParams) {
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
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
  if (identifier === undefined) {
    identifier = Uint8Array.from({ length: 32 }, () => 1);
  }

  return createPoolThrows({
    client,
    whitelist,
    owner,
    cosigner,
    identifier,
    config,
    t,
    message,
  });
}
