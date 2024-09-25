import {
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import { fetchPool, getEditPoolInstruction } from '../src/index.js';
import { ONE_WEEK, createPool, createWhitelistV2 } from './_common.js';

test('it can edit a pool w/ a new expiry date', async (t) => {
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
    expireInSec: ONE_WEEK,
  });

  const editPoolIx = getEditPoolInstruction({
    owner: updateAuthority,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    cosigner: null,
    maxTakerSellCount: null,
    resetPriceOffset: true,
  });

  await pipe(
    await createDefaultTransaction(client, updateAuthority),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolAccount = await fetchPool(client.rpc, pool);

  const expectedTimestampSecs = BigInt(Math.floor(Date.now() / 1000));
  const expiryDifference =
    poolAccount.data.expiry - (expectedTimestampSecs + BigInt(2 * ONE_WEEK));

  t.assert(expiryDifference < 10n && expiryDifference > -10n);
});
