import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  createDefaultTransaction,
  expectCustomError,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import { getWithdrawNftT22InstructionAsync, PoolType } from '../../src';
import {
  assertNftReceiptClosed,
  assertTokenNftOwnedBy,
  TestAction,
} from '../_common';
import { setupT22Test } from './_common';

test('it can withdraw a T22 NFT from a Trade pool', async (t) => {
  const { client, signers, nft, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
  });

  const { poolOwner } = signers;

  const { mint, extraAccountMetas } = nft;

  // Withdraw NFT from the pool
  const ix = await getWithdrawNftT22InstructionAsync({
    owner: poolOwner,
    pool,
    mint,
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now custodied by the owner again.
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: poolOwner.address,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint, pool });
});

test('it cannot withdraw an NFT from a Trade pool with wrong owner', async (t) => {
  const { client, pool, nft } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });

  const notPoolOwner = await generateKeyPairSignerWithSol(client);

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftT22InstructionAsync({
    owner: notPoolOwner,
    pool,
    mint: nft.mint,
    transferHookAccounts: nft.extraAccountMetas.map((a) => a.address),
  });

  const promise = pipe(
    await createDefaultTransaction(client, notPoolOwner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Throws constraint seeds error
  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('it can withdraw an NFT from a NFT pool', async (t) => {
  const { client, pool, nft, signers } = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftT22InstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
    transferHookAccounts: nft.extraAccountMetas.map((a) => a.address),
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now custodied by the owner again.
  await assertTokenNftOwnedBy({
    t,
    client,
    mint: nft.mint,
    owner: signers.poolOwner.address,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint: nft.mint, pool });
});

test('it cannot withdraw an NFT from a NFT pool with wrong owner', async (t) => {
  const { client, pool, nft } = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });

  const notPoolOwner = await generateKeyPairSignerWithSol(client);

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftT22InstructionAsync({
    owner: notPoolOwner,
    pool,
    mint: nft.mint,
    transferHookAccounts: nft.extraAccountMetas.map((a) => a.address),
  });

  const promise = pipe(
    await createDefaultTransaction(client, notPoolOwner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Throws constraint seeds error
  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});
