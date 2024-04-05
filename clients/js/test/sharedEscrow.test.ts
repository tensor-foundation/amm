import test from 'ava';
import { generateKeyPairSigner } from '@solana/signers';
import {
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import { appendTransactionInstruction, none, pipe } from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Pool,
  SharedEscrow,
  fetchPool,
  fetchSharedEscrow,
  findSharedEscrowPda,
  getAttachPoolToSharedEscrowInstruction,
  getInitSharedEscrowAccountInstruction,
} from '../src/index.js';
import { createPool, createWhitelistV2 } from './_common.js';

test('it can create a pool and attach it to a shared escrow', async (t) => {
  const client = createDefaultSolanaClient();
  const owner = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();

  // Setup a basic whitelist to use with the pool.
  const conditions = [{ mode: Mode.FVC, value: owner.address }];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: owner.address,
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
    owner,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>(<unknown>{
    address: pool,
    data: {
      owner: owner.address,
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

  const sharedEscrowNr = 0;
  const name = new Uint8Array(32).fill(1);

  const [sharedEscrow] = await findSharedEscrowPda({
    owner: owner.address,
    nr: sharedEscrowNr,
  });

  // Create a shared escrow
  const initSharedEscrowIx = getInitSharedEscrowAccountInstruction({
    owner,
    sharedEscrow,
    sharedEscrowNr,
    name,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(initSharedEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const sharedEscrowAccount = await fetchSharedEscrow(client.rpc, sharedEscrow);

  t.like(sharedEscrowAccount, <SharedEscrow>(<unknown>{
    address: sharedEscrow,
    data: {
      owner: owner.address,
      name,
      nr: sharedEscrowNr,
      poolsAttached: 0,
    },
  }));

  const attachIx = getAttachPoolToSharedEscrowInstruction({
    owner,
    pool,
    sharedEscrow,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(attachIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const updatedSharedEscrowAccount = await fetchSharedEscrow(
    client.rpc,
    sharedEscrow
  );

  t.like(updatedSharedEscrowAccount, <SharedEscrow>(<unknown>{
    address: sharedEscrow,
    data: {
      owner: owner.address,
      name,
      nr: sharedEscrowNr,
      poolsAttached: 1,
    },
  }));
});
