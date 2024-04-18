import { appendTransactionInstruction, pipe } from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import test from 'ava';
import {
  Pool,
  SharedEscrow,
  fetchPool,
  fetchSharedEscrow,
  getAttachPoolToSharedEscrowInstruction,
  getDepositSharedEscrowAccountInstruction,
} from '../src/index.js';
import { createPoolAndWhitelist } from './_common.js';
import { initSharedEscrow } from './_sharedEscrow.js';

test('it can create a pool and attach it to a shared escrow', async (t) => {
  const client = createDefaultSolanaClient();

  // Create default pool
  const { pool, owner } = await createPoolAndWhitelist({ client });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>{
    address: pool,
    data: {
      owner: owner.address,
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: null,
      },
    },
  });

  const { sharedEscrow, name, sharedEscrowNr } = await initSharedEscrow({
    client,
    owner,
  });

  const sharedEscrowAccount = await fetchSharedEscrow(client.rpc, sharedEscrow);

  t.like(sharedEscrowAccount, <SharedEscrow>{
    address: sharedEscrow,
    data: {
      owner: owner.address,
      name,
      nr: sharedEscrowNr,
      poolsAttached: 0,
    },
  });

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

test('it can deposit funds to a shared escrow', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);

  // Create default shared escrow.
  const { sharedEscrow, name, sharedEscrowNr } = await initSharedEscrow({
    client,
    owner,
  });

  // Check that the shared escrow was created correctly.
  const sharedEscrowAccount = await fetchSharedEscrow(client.rpc, sharedEscrow);

  const rentLamports = sharedEscrowAccount.lamports;

  t.like(sharedEscrowAccount, <SharedEscrow>{
    address: sharedEscrow,
    data: {
      owner: owner.address,
      name,
      nr: sharedEscrowNr,
      poolsAttached: 0,
    },
  });

  const depositLamports = 10_000_000n;

  const depositIx = getDepositSharedEscrowAccountInstruction({
    owner,
    sharedEscrow,
    lamports: depositLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const updatedSharedEscrowAccount = await fetchSharedEscrow(
    client.rpc,
    sharedEscrow
  );

  t.assert(
    updatedSharedEscrowAccount.lamports === depositLamports + rentLamports
  );

  t.like(updatedSharedEscrowAccount, <SharedEscrow>(<unknown>{
    address: sharedEscrow,
    data: {
      owner: owner.address,
      name,
      nr: sharedEscrowNr,
      poolsAttached: 0,
    },
  }));
});
