/* eslint-disable import/no-extraneous-dependencies */
import test from 'ava';
import { none, some } from '@solana/options';
import { generateKeyPairSigner } from '@solana/signers';
import {
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import { CurveType, Pool, PoolType, fetchPool } from '../src';
import {
  createDefaultSolanaClient,
  generateKeyPairSignerWithSol,
} from './_setup';
import {
  createPool,
  createPoolThrows,
  createWhitelistV2,
  tradePoolConfig,
} from './_common';

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
  const { pool } = await createPool({ client, whitelist });

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
  t.assert(poolAccount.data.expiresAt === 0n);
});
