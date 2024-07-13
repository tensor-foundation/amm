import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  appendTransactionMessageInstruction,
  isSolanaError,
  pipe,
} from '@solana/web3.js';
import {
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
} from '@tensor-foundation/mpl-token-metadata';
import test from 'ava';
import {
  PoolType,
  fetchPool,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  getWithdrawSolInstruction,
  isSol,
} from '../src/index.js';
import {
  createPool,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  tradePoolConfig,
} from './_common.js';

test('it can withdraw Sol from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: nftOwner.address }],
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
  const { mint } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: 10_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
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
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

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

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const depositLamports = 10_000_000n;
  // Min rent for POOL_SIZE account
  const keepAliveLamports = 3090240n;

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: nftOwner.address }],
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

  // PoolKeepAlive
  const code = 12039;

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
});

test('withdrawing Sol from a Trade pool decreases currency amount', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const depositLamports = 10n * config.startingPrice;
  const withdrawLamports = 5n * config.startingPrice;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: nftOwner.address }],
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

  // Currency amount should be what was deposited minues what was withdrawn.
  t.assert(poolAccount.data.amount === depositLamports - withdrawLamports);
});


test('it cannot withdraw from a pool with incorrect owner', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const notOwner = await generateKeyPairSignerWithSol(client);
  const depositLamports = 10_000_000n;
  const withdrawLamports = 1n; 

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  let poolAccount = await fetchPool(client.rpc, pool);

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

  // Try withdrawing SOL from pool with incorrect owner
  const withdrawSolIxBadOwner = getWithdrawSolInstruction({
    owner: notOwner,
    pool,
    lamports: withdrawLamports,
  });

  const POOL_SEEDS_VIOLATION_ERROR_CODE = 2006;

  const promiseBadOwner = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawSolIxBadOwner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  // Throws POOL_SEEDS_VIOLATION error
  await expectCustomError(t, promiseBadOwner, POOL_SEEDS_VIOLATION_ERROR_CODE);

  // And the pool still has the deposit amount remaining
  poolAccount = await fetchPool(client.rpc, pool);
  t.assert(poolAccount.data.amount === depositLamports);
});