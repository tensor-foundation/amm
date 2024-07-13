import { Account, Address, generateKeyPairSigner } from '@solana/web3.js';
import {
  TSWAP_SINGLETON,
  createDefaultSolanaClient,
  generateKeyPairSignerWithSol,
} from '@tensor-foundation/test-helpers';
import {
  Condition,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import { CurveType, Pool, PoolType, fetchPool } from '../src/index.js';
import {
  createPool,
  createPoolThrows,
  createWhitelistV2,
  getAndFundOwner,
  tokenPoolConfig,
  tradePoolConfig,
} from './_common.js';
import { findMarginAccountPda } from '@tensor-foundation/escrow';

test('it can create a pool w/ correct timestamps', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: 2, value: updateAuthority.address },
    { mode: 1, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  // Create default pool
  const { pool } = await createPool({
    client,
    whitelist,
    owner: updateAuthority,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>(<unknown>{
    address: pool,
    data: {
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: null,
      },
    },
  }));

  const expectedTimestampSecs = BigInt(Math.floor(Date.now() / 1000));
  const oneYear = 60n * 60n * 24n * 365n;

  const createdAtDifference =
    expectedTimestampSecs - poolAccount.data.createdAt;
  const updatedAtDifference =
    expectedTimestampSecs - poolAccount.data.updatedAt;

  // No expiry passed in so it is set to max value, 1 year from timestamp.
  const expiryDifference =
    poolAccount.data.expiry - (expectedTimestampSecs + oneYear);

  // Should be within 10 seconds either side of the expected timestamp.
  // Might have to update this for a wider drift.
  t.assert(createdAtDifference >= -10n && createdAtDifference <= 10n);
  t.assert(updatedAtDifference >= -10n && updatedAtDifference <= 10n);
  t.assert(expiryDifference >= -10n && expiryDifference <= 10n);
});

test('it can create a pool w/ a specific expiry time', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  const oneWeek = 60 * 60 * 24 * 7;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: 2, value: updateAuthority.address },
    { mode: 1, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  // Create default pool
  const { pool } = await createPool({
    client,
    whitelist,
    owner: updateAuthority,
    expireInSec: oneWeek,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>(<unknown>{
    address: pool,
    data: {
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: null,
      },
    },
  }));

  const expectedTimestampSecs = BigInt(Math.floor(Date.now() / 1000));

  const createdAtDifference =
    expectedTimestampSecs - poolAccount.data.createdAt;
  const updatedAtDifference =
    expectedTimestampSecs - poolAccount.data.updatedAt;

  // No expiry passed in so it is set to max value, 1 year from timestamp.
  const expiryDifference =
    poolAccount.data.expiry - (expectedTimestampSecs + BigInt(oneWeek));

  // Should be within 10 seconds either side of the expected timestamp.
  // Might have to update this for a wider drift.
  t.assert(createdAtDifference >= -10n && createdAtDifference <= 10n);
  t.assert(updatedAtDifference >= -10n && updatedAtDifference <= 10n);
  t.assert(expiryDifference >= -10n && expiryDifference <= 10n);
});

test('it cannot init exponential pool with 100% delta', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions: Condition[] = [
    { mode: 2, value: updateAuthority.address as Address },
    { mode: 1, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  await createPoolThrows({
    client,
    whitelist,
    owner: updateAuthority,
    config: {
      ...tokenPoolConfig,
      poolType: PoolType.Token,
      curveType: CurveType.Exponential,
      delta: 10_000n, // 100% delta, basis points
    },
    t,
    // 0x2ee8 - 12008 DeltaTooLarge
    code: 12008,
  });
});

test('it cannot init non-trade pool with mmFees', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: 2, value: updateAuthority.address },
    { mode: 1, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  await createPoolThrows({
    client,
    whitelist,
    owner: updateAuthority,
    config: {
      poolType: PoolType.Token,
      curveType: CurveType.Exponential,
      delta: 10n,
      startingPrice: 1n,
      mmCompoundFees: false,
      mmFeeBps: 100, // this fee should not be allowed
    },
    t,
    // 0x2ef1 - 12017 DeltaTooLarge
    code: 12017,
  });
});

test('it cannot init trade pool with no fees or high fees', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const owner1 = await generateKeyPairSignerWithSol(client);
  const owner2 = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: 2, value: updateAuthority.address },
    { mode: 1, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  await createPool({
    client,
    whitelist,
    owner: owner1,
    config: {
      ...tradePoolConfig,
      mmFeeBps: 9_900, // should succeed
    },
  });

  await createPoolThrows({
    client,
    whitelist,
    owner: owner2,
    config: {
      ...tradePoolConfig,
      mmFeeBps: 10_000, // too high, should fail
    },
    t,
    code: 12007, // 0x2ef1 - 12007 FeesTooHigh
  });
});

test('it can create a pool w/ shared escrow', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: 2, value: updateAuthority.address },
    { mode: 1, value: voc },
  ];

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Create pool attached to shared escrow
  await getAndFundOwner(client);
  const [ margin ] = await findMarginAccountPda({
    owner: updateAuthority.address,
    tswap: TSWAP_SINGLETON,
    marginNr: 0,
  });
  const { pool } = await createPool({
    client,
    whitelist,
    owner: updateAuthority,
    sharedEscrow: margin,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Account<Pool, Address>>{
    address: pool,
    data: {
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: null,
      },
      sharedEscrow: margin,
    },
  });
});