import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  AssetV1,
  createDefaultAsset,
  createDefaultAssetWithCollection,
  createDefaultCollection,
  Creator,
  fetchAssetV1,
} from '@tensor-foundation/mpl-core';
import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  getBalance,
  LAMPORTS_PER_SOL,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftCoreInstructionAsync,
  getCurrentAskPrice,
  getDepositNftCoreInstructionAsync,
  getEditPoolInstruction,
  isSol,
  Pool,
  PoolType,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
} from '../../src/index.js';
import {
  assertNftReceiptClosed,
  assertTammNoop,
  BASIS_POINTS,
  createPool,
  createProofWhitelist,
  createWhitelistV2,
  expectCustomError,
  getAndFundFeeVault,
  MAX_MM_FEES_BPS,
  nftPoolConfig,
  TestAction,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';
import { setupCoreTest, testBuyNft } from './_common.js';

test('buy from NFT pool', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, coreTest, {
    brokerPayments: false,
  });
});

test('buy from NFT pool, wrong owner fails', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const wrongOwner = await generateKeyPairSigner();
  coreTest.signers.poolOwner = wrongOwner;

  // The seeds derivation will fail.
  await testBuyNft(t, coreTest, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('buy from Trade pool, wrong owner fails', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const wrongOwner = await generateKeyPairSigner();
  coreTest.signers.poolOwner = wrongOwner;

  // The seeds derivation will fail.
  await testBuyNft(t, coreTest, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('buy from NFT pool, pay brokers', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: true,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, coreTest, {
    brokerPayments: true,
  });
});

test('buy from NFT pool, max creators large proof', async (t) => {
  const creatorSigners = await Promise.all(
    Array.from({ length: 5 }, () => generateKeyPairSigner())
  );

  const creators: Creator[] = creatorSigners.map(({ address }) => ({
    address,
    percentage: 20,
  }));

  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    creators,
    treeSize: 10_000,
    whitelistMode: Mode.MerkleTree,
  });

  await testBuyNft(t, coreTest, {
    brokerPayments: false,
    creators,
  });
});

test('buy from NFT pool, skip non-rent-exempt creators', async (t) => {
  const client = createDefaultSolanaClient();

  // Fund the first 3 creators with 1 SOL so they're rent exempt.
  const creatorSigners = await Promise.all(
    Array.from({ length: 3 }, () => generateKeyPairSignerWithSol(client))
  );
  // Add two more creators to the end of the array that are not rent exempt.
  creatorSigners.push(
    ...(await Promise.all(
      Array.from({ length: 2 }, () => generateKeyPairSigner())
    ))
  );

  const creators: Creator[] = creatorSigners.map(({ address }) => ({
    address,
    percentage: 20,
  }));

  // Set starting price low enough that the royalties don't push it above the rent exempt threshold.
  let config = nftPoolConfig;
  config.startingPrice = 10000n;
  config.delta = config.startingPrice / 10n;

  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    creators,
    treeSize: 10_000,
    whitelistMode: Mode.MerkleTree,
  });

  const creatorStartingBalances = await Promise.all(
    creatorSigners.map(({ address }) => getBalance(client, address))
  );

  await testBuyNft(t, coreTest, {
    brokerPayments: false,
    creators,
  });

  // First three creators should have a higher balance.
  for (const [i, creator] of creatorSigners.slice(0, 3).entries()) {
    const balance = await getBalance(client, creator.address);
    t.assert(balance > creatorStartingBalances[i]);
  }

  // Last two creators should have 0 balance.
  for (const creator of creatorSigners.slice(-2)) {
    const balance = await getBalance(client, creator.address);
    t.assert(balance === 0n);
  }
});

test('buy from NFT pool, max price higher than current price succeeds', async (t) => {
  t.timeout(15_000);
  for (const adjust of [101n, 10000n]) {
    const coreTest = await setupCoreTest({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the pre-configured maxPrice which includes the royalties.
    coreTest.testConfig.price = (coreTest.testConfig.price * adjust) / 100n;

    await testBuyNft(t, coreTest, {
      brokerPayments: false,
    });
  }
});

test('buy from NFT pool, max price lower than current price fails', async (t) => {
  t.timeout(15_000);
  for (const adjust of [99n, 50n]) {
    const coreTest = await setupCoreTest({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the starting price which does not have royalties added, so we can test the price mismatch logic.
    coreTest.testConfig.price =
      (coreTest.testConfig.poolConfig.startingPrice * adjust) / 100n;

    await testBuyNft(t, coreTest, {
      brokerPayments: false,
      expectError: TENSOR_AMM_ERROR__PRICE_MISMATCH,
    });
  }
});

test('buy from wrong NFT pool fails', async (t) => {
  t.timeout(15_000);
  const client = createDefaultSolanaClient();
  const payer = await generateKeyPairSignerWithSol(client);
  const traderA = await generateKeyPairSignerWithSol(client);
  const traderB = await generateKeyPairSignerWithSol(client);

  // Mint NFT
  const [nftA, collectionA] = await createDefaultAssetWithCollection({
    client,
    payer,
    owner: traderA.address,
    collectionAuthority: traderA,
  });

  // Mint NFT
  const [nftB, collectionB] = await createDefaultAssetWithCollection({
    client,
    payer,
    owner: traderB.address,
    collectionAuthority: traderB,
  });

  const { whitelist, proofs } = await createProofWhitelist(
    client,
    traderA,
    [nftA.address, nftB.address],
    4
  );

  // Create pools
  const { pool: poolA } = await createPool({
    client,
    payer,
    owner: traderA,
    config: nftPoolConfig,
    whitelist,
  });

  const { pool: poolB } = await createPool({
    client,
    payer,
    owner: traderB,
    config: nftPoolConfig,
    whitelist,
  });

  // Create mint proofs
  const { mintProof: mintProofA } = await upsertMintProof({
    client,
    payer,
    mint: nftA.address,
    whitelist,
    proof: proofs[0].proof,
  });

  const { mintProof: mintProofB } = await upsertMintProof({
    client,
    payer,
    mint: nftB.address,
    whitelist,
    proof: proofs[1].proof,
  });

  // Deposit NFTs into resepective pools
  const depositNftIxA = await getDepositNftCoreInstructionAsync({
    pool: poolA,
    asset: nftA.address,
    collection: collectionA.address,
    owner: traderA,
    whitelist,
    mintProof: mintProofA,
  });
  const depositNftIxB = await getDepositNftCoreInstructionAsync({
    pool: poolB,
    asset: nftB.address,
    collection: collectionB.address,
    owner: traderB,
    whitelist,
    mintProof: mintProofB,
  });

  await pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(depositNftIxA, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIxB, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Try to buy NFT B from pool A, the default derived NFT receipt will be from
  // pool A and NFT B which won't exist so the error is account unintialized.
  let buyNftIx = await getBuyNftCoreInstructionAsync({
    rentPayer: payer.address,
    owner: traderA.address,
    pool: poolA,
    taker: traderB,
    asset: nftB.address,
    collection: collectionB.address,
    maxAmount: 1n,
  });

  let promise = pipe(
    await createDefaultTransaction(client, traderB),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);

  // Try to buy NFT B from pool A, but use the correct NFT receipt and token accounts so they exist.
  // The error will then be a seeds constraint error because  the NFT receipt passed in doesn't match the
  // one in the pool.

  // Derive  NFT receipt
  const [nftReceiptA] = await findNftDepositReceiptPda({
    mint: nftA.address,
    pool: poolA,
  });

  buyNftIx = await getBuyNftCoreInstructionAsync({
    rentPayer: payer.address,
    owner: traderA.address,
    pool: poolA,
    taker: traderB,
    asset: nftB.address,
    collection: collectionB.address,
    maxAmount: 1n,
    nftReceipt: nftReceiptA,
  });

  promise = pipe(
    await createDefaultTransaction(client, traderB),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);

  // Try to buy NFT A from pool B, the default derived NFT receipt will be from
  // pool B and NFT A which won't exist so the error is account uninitialized.
  buyNftIx = await getBuyNftCoreInstructionAsync({
    rentPayer: payer.address,
    owner: traderB.address,
    pool: poolB,
    taker: traderA,
    asset: nftA.address,
    collection: collectionA.address,
    maxAmount: 1n,
  });

  promise = pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);

  // Try to buy NFT A from pool B, but use the correct NFT receipt and token accounts so they exist.
  // The error will then be a seeds constraint error because the NFT receipt passed in doesn't match the
  // one in the pool.

  // Derive NFT receipt
  const [nftReceiptB] = await findNftDepositReceiptPda({
    mint: nftB.address,
    pool: poolB,
  });

  buyNftIx = await getBuyNftCoreInstructionAsync({
    rentPayer: payer.address,
    owner: traderB.address,
    pool: poolB,
    taker: traderA,
    asset: nftA.address,
    collection: collectionA.address,
    maxAmount: 1n,
    nftReceipt: nftReceiptB,
  });

  promise = pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('buy from Trade pool', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, coreTest, {
    brokerPayments: false,
  });
});

test('buy from Trade pool, pay brokers', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: true,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, coreTest, {
    brokerPayments: true,
  });
});

test('buy from Trade pool, max price higher than current price succeeds', async (t) => {
  t.timeout(15_000);
  for (const adjust of [101n, 10000n]) {
    const coreTest = await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the pre-configured maxPrice which includes the mm fee and royalties.
    coreTest.testConfig.price = (coreTest.testConfig.price * adjust) / 100n;

    await testBuyNft(t, coreTest, {
      brokerPayments: false,
    });
  }
});

test('buy from Trade pool, max price lower than current price fails', async (t) => {
  t.timeout(15_000);
  for (const adjust of [99n, 50n]) {
    const coreTest = await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the starting price which does not have mm fee androyalties added, so we can test the price mismatch logic.
    coreTest.testConfig.price =
      (coreTest.testConfig.poolConfig.startingPrice * adjust) / 100n;

    await testBuyNft(t, coreTest, {
      brokerPayments: false,
      expectError: TENSOR_AMM_ERROR__PRICE_MISMATCH,
    });
  }
});

test('buy from Token pool fails', async (t) => {
  // Setup a Token pool, funded with SOL.
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
  });

  // The NFT receipt for this mint and pool doesn't exist so it should fail with an
  // Anchor account not initialized error.
  // It hits this constraint issue before the pool type check.
  await testBuyNft(t, coreTest, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  });
});

test('it can buy an NFT from a Trade pool w/ Merkle Root whitelist', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, feeVault } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      whitelistMode: Mode.MerkleTree,
      useMakerBroker: true,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { poolConfig } = testConfig;

  // Max amount is the maximum price the user is willing to pay for the NFT + creators fee and mm fee, if applicable.
  const mmFee = poolConfig.startingPrice * BigInt(poolConfig.mmFeeBps ?? 0);
  const royalties = (poolConfig.startingPrice * 500n) / 10000n;
  // It should work with exact amount, but users might also pad this to allow for slippage.
  const maxAmount = poolConfig.startingPrice + mmFee + royalties;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    maxAmount,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 1,
        takerSellCount: 0,
      },
    },
  });

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Deposit Receipt is closed
  await assertNftReceiptClosed({ t, client, pool, mint: asset.address });
});

test('buying NFT from a trade pool increases currency amount', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: false,
      useMakerBroker: true,
      compoundFees: true,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority, takerBroker, makerBroker } =
    signers;
  const { poolConfig, price: maxAmount } = testConfig;

  // Balance of pool before any sales operations.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const poolAccount = await fetchPool(client.rpc, pool);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    takerBroker: takerBroker.address,
    makerBroker: makerBroker.address,
    maxAmount,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

  // This is a Trade pool with mm compound fees so funds go to the pool instead of straight through to the pool's owner.
  // The pool's post balance should be the pre-balance plus the price paid for the NFT plus the mm fee.
  const mmFee =
    (poolConfig.startingPrice * BigInt(poolConfig.mmFeeBps ?? 0)) /
    BASIS_POINTS;

  const lamportsAdded = poolConfig.startingPrice + mmFee;

  t.assert(postPoolBalance === prePoolBalance + lamportsAdded);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one buy so the pool currency amount should just be the new lamports added.
  t.assert(updatedPoolAccount.data.amount === lamportsAdded);
});

test('it can buy a NFT and pay the correct amount of royalties', async (t) => {
  const { client, signers, asset, collection, pool, feeVault, testConfig } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
    });

  const { buyer, poolOwner, nftUpdateAuthority: creator } = signers;
  const { poolConfig, price: maxAmount, sellerFeeBasisPoints } = testConfig;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [creator.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetComputeUnitLimitInstruction({ units: 400_000 }),
        tx
      ),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Creator receives exactly the sellerFeeBasisPoints of the buy price
  // postBalance === preBalance + currentPrice * sellerFeeBasisPoints / 100_00
  const endingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  t.assert(
    endingCreatorBalance ===
      startingCreatorBalance +
        (BigInt(sellerFeeBasisPoints) * poolConfig.startingPrice) / 100_00n
  );
});

test('buyNft from a Trade pool emits a self-cpi logging event', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

  assertTammNoop(t, client, sig);
});

test('buyNft from a NFT pool emits a self-cpi logging event', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

  assertTammNoop(t, client, sig);
});

test('buying the last NFT from a NFT pool auto-closes the pool', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);
  const rentPayer = await generateKeyPairSignerWithSol(client);

  const config = nftPoolConfig;

  // Mint NFTs
  const [asset1, collection] = await createDefaultAssetWithCollection({
    client,
    payer: owner,
    collectionAuthority: owner,
    owner: owner.address,
  });

  const asset2 = await createDefaultAsset({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
    collection: collection.address,
  });

  // Create whitelist with VOC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.VOC, value: collection.address }],
  });

  // Create pool
  const { pool } = await createPool({
    client,
    payer: rentPayer,
    whitelist,
    owner,
    config,
  });

  // 1.1x the starting price.
  const maxAmount = (config.startingPrice * 100n) / 10n + config.startingPrice;

  let poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.NFT);

  // Deposit NFTs
  const depositNftIx1 = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset1.address,
    collection: collection.address,
  });

  const depositNftIx2 = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset2.address,
    collection: collection.address,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx1, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIx2, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFTs are now owned by the pool.
  t.like(await fetchAssetV1(client.rpc, asset1.address), <
    Account<AssetV1, Address>
  >{
    address: asset1.address,
    data: {
      owner: pool,
    },
  });

  t.like(await fetchAssetV1(client.rpc, asset2.address), <
    Account<AssetV1, Address>
  >{
    address: asset2.address,
    data: {
      owner: pool,
    },
  });

  await getAndFundFeeVault(client, pool);

  // Buy the first NFT from pool
  const buyNftIx1 = await getBuyNftCoreInstructionAsync({
    owner: owner.address,
    taker: buyer,
    rentPayer: rentPayer.address,
    pool,
    asset: asset1.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx1, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Pool is still open
  poolAccount = await fetchPool(client.rpc, pool);
  t.assert(poolAccount.data.config.poolType === PoolType.NFT);

  // Buy the second NFT from pool
  const buyNftIx2 = await getBuyNftCoreInstructionAsync({
    owner: owner.address,
    taker: buyer,
    rentPayer: rentPayer.address,
    pool,
    asset: asset2.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx2, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Pool is now closed as there are no more NFTs left to buy.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);
});

test('it can buy an NFT from a pool w/ shared escrow', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, sharedEscrow } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: true,
      compoundFees: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { poolConfig, price: maxAmount } = testConfig;

  const startingEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    sharedEscrow,
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Shared Escrow balance increases exactly by the pool's startingPrice.
  const endingEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;
  t.assert(
    startingEscrowBalance === endingEscrowBalance - poolConfig.startingPrice
  );
});

test('it can buy an NFT from a pool w/ set cosigner', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useCosigner: true,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority, cosigner } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    creators: [nftUpdateAuthority.address],
    cosigner,
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });
});

test('it cannot buy an NFT from a pool w/ incorrect cosigner', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useCosigner: true,
      fundPool: false,
    });

  const fakeCosigner = await generateKeyPairSigner();

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool without specififying cosigner
  const buyNftIxNoCosigner = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    creators: [nftUpdateAuthority.address],
  });

  const promiseNoCosigner = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxNoCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseNoCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );

  // Buy NFT from pool with fakeCosigner
  const buyNftIxIncorrectCosigner = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    creators: [nftUpdateAuthority.address],
    cosigner: fakeCosigner,
  });

  const promiseIncorrectCosigner = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxIncorrectCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseIncorrectCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );
});

test('it cannot buy an NFT from a trade pool w/ incorrect deposit receipt', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);

  // Mint NFT in a collection.
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer: owner,
    collectionAuthority: owner,
    owner: owner.address,
  });

  // Mint another NFT
  const assetNotInPool = await createDefaultAsset({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
    collection: collection.address,
  });

  const config = tradePoolConfig;

  // Create whitelist using the collection address as the condition.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.VOC, value: collection.address }],
  });

  // Create pool
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Deposit NFT
  const depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });

  // Buy NFT from pool with incorrect deposit receipt (not deposited asset)
  const [incorrectNftReceipt] = await findNftDepositReceiptPda({
    pool,
    mint: assetNotInPool.address,
  });
  const buyNftIxNotDepositedNft = await getBuyNftCoreInstructionAsync({
    owner: owner.address,
    taker: buyer,
    pool,
    asset: assetNotInPool.address,
    collection: collection.address,
    maxAmount: config.startingPrice,
    nftReceipt: incorrectNftReceipt,
    creators: [owner.address],
  });

  const promiseNotDeposited = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxNotDepositedNft, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseNotDeposited,
    ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED
  );

  // Initialize a different pool
  const { pool: otherPool } = await createPool({
    client,
    whitelist,
    owner,
    config,
    poolId: Uint8Array.from({ length: 32 }, () => 0),
  });
  // Deposit NFT
  const depositNftIxIntoOtherPool = await getDepositNftCoreInstructionAsync({
    owner,
    pool: otherPool,
    whitelist,
    asset: assetNotInPool.address,
    collection: collection.address,
  });
  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIxIntoOtherPool, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [incorrectNftReceiptOtherPool] = await findNftDepositReceiptPda({
    pool: otherPool,
    mint: assetNotInPool.address,
  });
  const buyNftIxWrongPoolNftReceipt = await getBuyNftCoreInstructionAsync({
    owner: owner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount: config.startingPrice,
    nftReceipt: incorrectNftReceiptOtherPool,
    creators: [owner.address],
  });

  const promiseWrongPool = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) =>
      appendTransactionMessageInstruction(buyNftIxWrongPoolNftReceipt, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseWrongPool, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('pool owner cannot perform a sandwich attack on the buyer on a Trade pool', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount, // Exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  // Pool owner edits the pool to update the mmFee to the maximum value.
  let newConfig = { ...tradePoolConfig, mmFeeBps: MAX_MM_FEES_BPS };

  let editPoolIx = getEditPoolInstruction({
    owner: poolOwner,
    pool,
    newConfig,
    resetPriceOffset: false,
  });

  // Pool owner edits the pool right before the buy instruction is executed.
  // Actual sandwich attack would be separate transactions, but this demonstrates the point as it's
  // a more generous assumption in favor of the attacker.
  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstructions([editPoolIx, buyNftIx], tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a price mismatch error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__PRICE_MISMATCH);

  // Pool owner should not be able to increase the mmFee value at all when an exact price is being passed in by the buyer,
  // which is the case in this test.
  const newMmFeeBps = tradePoolConfig.mmFeeBps! + 1;
  newConfig = { ...tradePoolConfig, mmFeeBps: newMmFeeBps };

  editPoolIx = getEditPoolInstruction({
    owner: poolOwner,
    pool,
    newConfig,
    resetPriceOffset: false,
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstructions([editPoolIx, buyNftIx], tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should still fail with a price mismatch error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__PRICE_MISMATCH);
});

test('pool with makerBroker set requires passing the account in; fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, asset, collection, testConfig, pool } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: true, // Maker broker set on pool
      useSharedEscrow: false,
      fundPool: false,
    });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;

  // Buy NFT from pool
  let buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount, // Exact price + mm_fees + royalties
    // no maker broker passed in
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  // Buy NFT from pool
  buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount, // Exact price + mm_fees + royalties
    makerBroker: fakeMakerBroker.address, // incorrect makerBroker
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('alternate deposits & buys', async (t) => {
  t.timeout(25_000);
  const client = createDefaultSolanaClient();
  const numBuys = 10;

  for (const poolType of [PoolType.NFT, PoolType.Trade]) {
    for (const curveType of [CurveType.Linear, CurveType.Exponential]) {
      const traderA = await generateKeyPairSignerWithSol(
        client,
        100n * LAMPORTS_PER_SOL
      );
      const traderB = await generateKeyPairSignerWithSol(
        client,
        100n * LAMPORTS_PER_SOL
      );

      const config = {
        poolType,
        curveType,
        startingPrice: 1_238_923_843n,
        delta:
          curveType === CurveType.Linear
            ? 1_238_923_843n / BigInt(numBuys)
            : 1021n,
        mmCompoundFees: true,
        mmFeeBps: poolType === PoolType.Trade ? 0 : null,
      };

      t.log('minting nfts');

      const sellerFeeBasisPoints = 100;

      // Create a collection
      const collection = await createDefaultCollection({
        client,
        payer: traderA,
        updateAuthority: traderA.address,
        royalties: {
          creators: [{ address: traderA.address, percentage: 100 }],
          basisPoints: sellerFeeBasisPoints,
        },
      });

      // Prepare multiple NFTs
      const nfts = await Promise.all(
        Array(numBuys)
          .fill(null)
          .map(async () => {
            const asset = await createDefaultAsset({
              client,
              payer: traderA,
              authority: traderA,
              owner: traderA.address,
              collection: collection.address,
            });
            return { asset, collection };
          })
      );

      t.log('creating whitelist and pool');

      // Prepare whitelist and pool
      const { whitelist } = await createWhitelistV2({
        client,
        updateAuthority: traderA,
        conditions: [{ mode: Mode.VOC, value: collection.address }],
      });

      const { pool } = await createPool({
        client,
        whitelist,
        owner: traderA,
        config,
      });

      // Deposit and buy NFTs sequentially
      let depositCount = 1;
      let buyCount = 0;

      t.log('initial deposit');

      // Initial deposit
      const nft = nfts[0];

      const depositNftIx = await getDepositNftCoreInstructionAsync({
        owner: traderA,
        pool,
        whitelist,
        asset: nft.asset.address,
        collection: nft.collection.address,
      });

      await pipe(
        await createDefaultTransaction(client, traderA),
        (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      let poolData = await fetchPool(client.rpc, pool);

      // Alternate between deposits and buys
      for (let i = 1; i < numBuys; i++) {
        // Deposit next NFT
        const nftToDeposit = nfts[depositCount];

        t.log(`depositing nft ${depositCount + 1}`);

        const depositNftIx = await getDepositNftCoreInstructionAsync({
          owner: traderA,
          pool,
          whitelist,
          asset: nftToDeposit.asset.address,
          collection: nftToDeposit.collection.address,
        });
        await pipe(
          await createDefaultTransaction(client, traderA),
          (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
          (tx) => signAndSendTransaction(client, tx)
        );
        depositCount++;

        t.log('buying nft');

        // Buy NFT
        const nftToBuy = nfts[buyCount];
        poolData = await fetchPool(client.rpc, pool);
        const currPrice = getCurrentAskPrice({
          pool: poolData.data,
          royaltyFeeBps: sellerFeeBasisPoints,
          extraOffset: 1,
          excludeMMFee: poolType === PoolType.NFT ? true : false,
        });

        const buyNftIx = await getBuyNftCoreInstructionAsync({
          owner: traderA.address,
          taker: traderB,
          pool,
          asset: nftToBuy.asset.address,
          collection: nftToBuy.collection.address,
          maxAmount: currPrice ?? 0n,
          creators: [traderA.address],
        });
        await pipe(
          await createDefaultTransaction(client, traderB),
          (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
          (tx) => signAndSendTransaction(client, tx)
        );
        buyCount++;
      }

      // Check NFTs have been transferred correctly
      for (let i = 0; i < buyCount; i++) {
        t.like(await fetchAssetV1(client.rpc, nfts[i].asset.address), {
          data: { owner: traderB.address },
        });
      }

      // Check remaining NFTs are still in the pool
      poolData = await fetchPool(client.rpc, pool);
      t.assert(poolData.data.nftsHeld === depositCount - buyCount);
    }
  }
});

test('buy a ton with default exponential curve + tolerance', async (t) => {
  t.timeout(120_000); // Increase timeout due to many operations

  const client = createDefaultSolanaClient();
  const numBuys = 47; // prime #

  const traderA = await generateKeyPairSignerWithSol(
    client,
    100_000n * LAMPORTS_PER_SOL
  );
  const traderB = await generateKeyPairSignerWithSol(
    client,
    100_000n * LAMPORTS_PER_SOL
  );

  const config = {
    poolType: PoolType.NFT,
    curveType: CurveType.Exponential,
    startingPrice: 2_083_195_757n, // ~2 SOL (prime #)
    delta: 877n, // 8.77% (prime #)
    mmCompoundFees: true,
    mmFeeBps: null,
  };

  t.log('minting nfts');

  // Create a collection
  const collection = await createDefaultCollection({
    client,
    payer: traderA,
    updateAuthority: traderA.address,
    royalties: {
      creators: [{ address: traderA.address, percentage: 100 }],
      basisPoints: 100,
    },
  });

  // Prepare multiple NFTs
  const nfts = await Promise.all(
    Array(numBuys)
      .fill(null)
      .map(async () => {
        const asset = await createDefaultAsset({
          client,
          payer: traderA,
          authority: traderA,
          owner: traderA.address,
          collection: collection.address,
        });
        return { asset, collection };
      })
  );

  t.log('creating whitelist and pool');

  // Prepare whitelist and pool
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: traderA,
    conditions: [{ mode: Mode.VOC, value: collection.address }],
  });

  const { pool } = await createPool({
    client,
    whitelist,
    owner: traderA,
    config,
  });

  t.log('depositing nfts');

  // Deposit all NFTs
  for (const nft of nfts) {
    const depositNftIx = await getDepositNftCoreInstructionAsync({
      owner: traderA,
      pool,
      whitelist,
      asset: nft.asset.address,
      collection: nft.collection.address,
    });

    await pipe(
      await createDefaultTransaction(client, traderA),
      (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  }

  t.log('buying nfts');

  // Buy NFTs sequentially
  for (const [buyCount, nft] of nfts.entries()) {
    const poolData = await fetchPool(client.rpc, pool);
    const currPrice = getCurrentAskPrice({
      pool: poolData.data,
      royaltyFeeBps: 0, // Assuming no royalties for simplicity
      extraOffset: 1,
      excludeMMFee: true,
    });

    t.log(`buying nft ${buyCount + 1} at price ${currPrice}`);

    const buyNftIx = await getBuyNftCoreInstructionAsync({
      owner: traderA.address,
      taker: traderB,
      pool,
      asset: nft.asset.address,
      collection: nft.collection.address,
      maxAmount: currPrice ?? 0n,
      creators: [traderA.address],
    });

    await pipe(
      await createDefaultTransaction(client, traderB),
      (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  }

  t.log('verifying nft ownership');

  // Check NFTs have been transferred correctly
  for (const nft of nfts) {
    t.like(await fetchAssetV1(client.rpc, nft.asset.address), {
      data: { owner: traderB.address },
    });
  }
});
