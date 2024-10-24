import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  createDefaultTransaction,
  expectCustomError,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  PoolType,
  TENSOR_AMM_ERROR__WRONG_POOL_TYPE,
  getDepositSolInstruction,
} from '../src/index.js';
import { ONE_SOL, TestAction } from './_common.js';
import { setupLegacyTest } from './legacy/_common.js';

test('deposit SOL into a NFT pool fails', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: signers.poolOwner,
    lamports: ONE_SOL,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});
