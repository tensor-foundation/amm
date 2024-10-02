import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  createDefaultTransaction,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
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
