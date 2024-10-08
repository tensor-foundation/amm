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
  CurveType,
  Pool,
  PoolConfig,
  PoolType,
  TENSOR_AMM_ERROR__EXISTING_NFTS,
  fetchMaybePool,
  fetchPool,
  getClosePoolInstruction,
  getDepositNftInstructionAsync,
  getDepositSolInstruction,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
} from '../src/index.js';
import {
  DEFAULT_DELTA,
  ONE_SOL,
  TRANSACTION_SIGNATURE_FEE,
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  expectCustomError,
  getAndFundFeeVault,
  getPoolStateBond,
  tradePoolConfig,
} from './_common.js';

test('it can close a pool', async (t) => {
  const client = createDefaultSolanaClient();

  // Create default pool
  const { pool, owner } = await createPoolAndWhitelist({
    client,
    funded: false,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>(<unknown>{
    address: pool,
    data: {
      rentPayer: owner.address,
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: null,
      },
    },
  }));

  // Close the pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then the pool is closed.
  const maybePoolAccount = await fetchMaybePool(client.rpc, pool);
  t.assert(!maybePoolAccount.exists);
});

test('close pool fails if nfts still deposited', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Mint NFTs
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
  });

  // Deposit NFT into pool
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__EXISTING_NFTS);
});

test('close token pool succeeds if someone sold nfts into it', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 10n * DEFAULT_DELTA,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: null,
  };

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

  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: owner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: owner.address,
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

  const poolOwnerBalance = (await client.rpc.getBalance(owner.address).send())
    .value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolAccount = await fetchMaybePool(client.rpc, pool);

  // Pool is closed.
  t.false(poolAccount.exists);

  // Funds should go back to the pool owner.
  const poolOwnerBalanceAfter = (
    await client.rpc.getBalance(owner.address).send()
  ).value;

  // Pool owner should have the balance of the pool because it is also the rent payer that created the pool originally.
  t.assert(
    poolOwnerBalanceAfter ===
      poolOwnerBalance + poolBalance - TRANSACTION_SIGNATURE_FEE
  );
});

test('close trade pool fail if someone sold nfts into it', async (t) => {
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

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__EXISTING_NFTS);
});

test('closing a pool returns excess funds to the owner', async (t) => {
  const client = createDefaultSolanaClient();

  const txPayer = await generateKeyPairSignerWithSol(client);
  const rentPayer = await generateKeyPairSignerWithSol(client);

  const depositAmount = 10_000_000n;

  const poolStateBond = await getPoolStateBond(client);

  // Create default pool
  const { pool, owner } = await createPoolAndWhitelist({
    client,
    payer: rentPayer,
    funded: false,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, txPayer),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const ownerStartingBalance = (
    await client.rpc.getBalance(owner.address).send()
  ).value;
  const rentPayerStartingBalance = (
    await client.rpc.getBalance(rentPayer.address).send()
  ).value;

  // Close the pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: rentPayer.address,
    owner,
    pool,
  });

  await pipe(
    await createDefaultTransaction(client, txPayer),
    (tx) => appendTransactionMessageInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then the pool is closed.
  const maybePoolAccount = await fetchMaybePool(client.rpc, pool);
  t.assert(!maybePoolAccount.exists);

  const ownerEndingBalance = (await client.rpc.getBalance(owner.address).send())
    .value;
  const rentPayerEndingBalance = (
    await client.rpc.getBalance(rentPayer.address).send()
  ).value;

  // The owner should have received the excess funds.
  t.assert(ownerEndingBalance === ownerStartingBalance + depositAmount);

  // The original rent payer should have received the pool rent back.
  t.assert(rentPayerEndingBalance === rentPayerStartingBalance + poolStateBond);
});
