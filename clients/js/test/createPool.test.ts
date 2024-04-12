import test from 'ava';
import { generateKeyPairSigner } from '@solana/signers';
import {
  Condition,
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import { Address, none, some } from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  generateKeyPairSignerWithSol,
} from '@tensor-foundation/test-helpers';
import { CurveType, Pool, PoolType, fetchPool } from '../src/index.js';
import {
  createPool,
  createPoolThrows,
  createWhitelistV2,
  tradePoolConfig,
} from './_common.js';

test('it can create a pool w/ correct timestamps', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
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

  const expectedTimestampSecs = BigInt(Math.floor(Date.now() / 1000));

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
        mmFeeBps: none(),
      },
    },
  }));

  // Should be within 10 seconds of the expected timestamp.
  // Might have to update this for a wider drift.
  const createdAtDifference =
    expectedTimestampSecs - poolAccount.data.createdAt;
  const updatedAtDifference =
    expectedTimestampSecs - poolAccount.data.updatedAt;

  t.assert(createdAtDifference >= 0n && createdAtDifference <= 10n);
  t.assert(updatedAtDifference >= 0n && updatedAtDifference <= 10n);
  t.assert(poolAccount.data.expiry === 0n);
});

test('it cannot init exponential pool with 100% delta', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions: Condition[] = [
    { mode: Mode.FVC, value: updateAuthority.address as Address },
    { mode: Mode.VOC, value: voc },
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
      ...tradePoolConfig,
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
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
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
      mmFeeBps: some(100), // this fee should not be allowed
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
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
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
      mmFeeBps: some(9_900), // should succeed
    },
  });

  await createPoolThrows({
    client,
    whitelist,
    owner: owner2,
    config: {
      ...tradePoolConfig,
      mmFeeBps: some(10_000), // too high, should fail
    },
    t,
    code: 12007, // 0x2ef1 - 12007 FeesTooHigh
  });
});
