import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import { createDefaultNft } from '@tensor-foundation/mpl-token-metadata';
import {
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  PoolType,
  TENSOR_AMM_ERROR__POOL_INSUFFICIENT_RENT,
  fetchPool,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  getWithdrawSolInstruction,
  isSol,
} from '../src/index.js';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  ONE_SOL,
  assertTokenNftOwnedBy,
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  expectCustomError,
  getAndFundFeeVault,
  tradePoolConfig,
} from './_common.js';

test('it can withdraw Sol from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftOwner,
    authority: nftOwner,
    owner: nftOwner.address,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: ONE_SOL,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: owner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftOwner.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(computeIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  await assertTokenNftOwnedBy({ t, client, owner: pool, mint });

  const preOwnerBalance = (await client.rpc.getBalance(owner.address).send())
    .value;

  const withdrawLamports = 1_000_000n;
  const txFee = 5_000n;

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: withdrawLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const postOwnerBalance = (await client.rpc.getBalance(owner.address).send())
    .value;

  t.assert(postOwnerBalance === preOwnerBalance + withdrawLamports - txFee);
});

test('it cannot withdraw all SOL from a pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const depositLamports = ONE_SOL;
  // Min rent for POOL_SIZE account
  const keepAliveLamports = 3090240n;

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: depositLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: depositLamports + keepAliveLamports,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__POOL_INSUFFICIENT_RENT);
});

test('withdrawing Sol from a Trade pool decreases currency amount', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const depositLamports = 10n * config.startingPrice;
  const withdrawLamports = 5n * config.startingPrice;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  let poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: depositLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  poolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(poolAccount.data.currency));

  // Currency amount should be what was deposited.
  t.assert(poolAccount.data.amount === depositLamports);

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: withdrawLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  poolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(poolAccount.data.currency));

  // Currency amount should be what was deposited minus what was withdrawn.
  t.assert(poolAccount.data.amount === depositLamports - withdrawLamports);
});

test('it cannot withdraw from a pool with incorrect owner', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool owner.
  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const notOwner = await generateKeyPairSignerWithSol(client);
  const depositAmount = ONE_SOL;
  const withdrawLamports = 1n;

  const config = tradePoolConfig;

  // Create a whitelist and a funded pool.
  const { pool } = await createPoolAndWhitelist({
    client,
    owner,
    config,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
    funded: true,
  });

  // Try withdrawing SOL from pool with incorrect owner
  const withdrawSolIxBadOwner = getWithdrawSolInstruction({
    owner: notOwner,
    pool,
    lamports: withdrawLamports,
  });

  const promiseBadOwner = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawSolIxBadOwner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  // Throws POOL_SEEDS_VIOLATION error
  await expectCustomError(t, promiseBadOwner, ANCHOR_ERROR__CONSTRAINT_SEEDS);

  // And the pool still has the deposit amount remaining
  const poolAccount = await fetchPool(client.rpc, pool);
  t.assert(poolAccount.data.amount === depositAmount);
});
