/* eslint-disable import/no-extraneous-dependencies */
import test from 'ava';
import { appendTransactionInstruction, none, pipe } from '@solana/web3.js';
import {
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import {
  createDefaultNft,
  findMetadataPda,
  mintNft,
} from '@tensor-foundation/toolkit-token-metadata';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  CurveType,
  Pool,
  PoolType,
  fetchMaybePool,
  fetchMaybeSolEscrow,
  fetchPool,
  getClosePoolInstruction,
} from '../src';
import {
  LAMPORTS_PER_SOL,
  createPoolAndWhitelist,
  tradePoolConfig,
} from './_common';

test('it can close a pool', async (t) => {
  const client = createDefaultSolanaClient();

  // Create default pool
  const { pool, owner, solEscrow } = await createPoolAndWhitelist({ client });

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

  // Close the pool
  const closePoolIx = getClosePoolInstruction({
    owner,
    pool,
    solEscrow,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then the pool and solEscrow are closed
  const maybePoolAccount = await fetchMaybePool(client.rpc, pool);
  t.assert(!maybePoolAccount.exists);
  const maybeSolEscrowAccount = await fetchMaybeSolEscrow(
    client.rpc,
    solEscrow
  );
  t.assert(!maybeSolEscrowAccount.exists);
});

// test('close pool fails if nfts still deposited', async (t) => {
//   const client = createDefaultSolanaClient();
//   const { owner } = await createPoolAndWhitelist({ client });

//   // Mint NFTs
//   const mint1 = await createDefaultNft(client, updateAuthority, payer, payer);
//   const [metadata] = await findMetadataPda({ mint });
//   // Deposit into pool
//   // Close pool
// });

// test('closing the pool roundtrips fees + deposited SOL', async (t) => {
//   // Todo: Implement this test
//   // requires importing/porting over a bunch of tensor-common helpers
//   t.pass();
// });

// test('it closes the pool and withdraws SOL from any buys in the TRADE pool', async (t) => {
//   const client = createDefaultSolanaClient();
//   const owner = await generateKeyPairSignerWithSol(client);
//   const buyer = await generateKeyPairSignerWithSol(client);
//   const config = tradePoolConfig;
//   const buyPrice = LAMPORTS_PER_SOL;

//   t.pass();
// });
