import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Commitment,
  CompilableTransaction,
  ITransactionWithBlockhashLifetime,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  appendTransactionInstruction,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  sendAndConfirmTransactionFactory,
  signTransactionWithSigners,
} from '@solana/web3.js';
import {
  Client,
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import test from 'ava';
import {
  CurveType,
  Pool,
  PoolConfig,
  PoolType,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getClosePoolInstruction,
  getDepositNftInstructionAsync,
  getDepositSolInstruction,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
} from '../src/index.js';
import {
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getPoolStateBond,
  tradePoolConfig,
} from './_common.js';

export interface TransactionOptions {
  commitment?: Commitment;
  skipPreflight?: boolean;
}

export const signAndSendTransaction = async (
  client: Client,
  transaction: CompilableTransaction & ITransactionWithBlockhashLifetime,
  options?: TransactionOptions
) => {
  const commitment = options?.commitment ?? 'confirmed';
  const skipPreflight = options?.skipPreflight ?? false;

  const signedTransaction = await signTransactionWithSigners(transaction);
  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirmTransactionFactory(client)(signedTransaction, {
    commitment,
    skipPreflight,
  });

  return signature;
};

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
    (tx) => appendTransactionInstruction(closePoolIx, tx),
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
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Mint NFTs
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // Deposit NFT into pool
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositNftIx, tx),
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
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  // ExistingNfts
  const code = 12013;

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
});

test('close token pool succeeds if someone sold nfts into it', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: null,
  };

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

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
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
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

  const minPrice = 1_000_000n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
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
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolAccount = await fetchMaybePool(client.rpc, pool);

  // Pool is closed.
  t.false(poolAccount.exists);
});

test('close trade pool fail if someone sold nfts into it', async (t) => {
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
  const { mint } = await createDefaultNft(client, nftOwner, nftOwner, nftOwner);

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: 10_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

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
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    rentPayer: owner.address,
    owner,
    pool,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  // ExistingNfts
  const code = 12013;

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
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
    (tx) => appendTransactionInstruction(depositSolIx, tx),
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
    (tx) => appendTransactionInstruction(closePoolIx, tx),
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
