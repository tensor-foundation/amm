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
  createAsset,
  createDefaultAssetWithCollection,
  Creator,
  fetchAssetV1,
  PluginAuthorityPairArgs,
  VerifiedCreatorsArgs,
} from '@tensor-foundation/mpl-core';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  getBalance,
  ONE_SOL,
  signAndSendTransaction,
  TENSOR_ERROR__INVALID_CORE_ASSET,
  TSWAP_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import {
  intoAddress,
  Mode,
  TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION,
  TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  fetchMaybePool,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositSolInstruction,
  getEditPoolInstruction,
  getSellNftTokenPoolCoreInstructionAsync,
  getSellNftTradePoolCoreInstructionAsync,
  isSol,
  NftDepositReceipt,
  PoolType,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
  TENSOR_AMM_ERROR__WRONG_POOL_TYPE,
  TENSOR_AMM_ERROR__WRONG_WHITELIST,
} from '../../src/index.js';
import {
  assertTammNoop,
  createPool,
  createWhitelistV2,
  expectCustomError,
  getAndFundFeeVault,
  getTestSigners,
  MAX_MM_FEES_BPS,
  TestAction,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';
import { generateTreeOfSize } from '../_merkle.js';
import { setupCoreTest, testSell } from './_common.js';

test('it can sell an NFT into a Token pool', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    feeVault,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    compoundFees: false,
    fundPool: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { poolConfig, price: minPrice, depositAmount } = testConfig;

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the pool owner.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: poolOwner.address,
    },
  });

  // Fee vault balance increases.
  const postSaleFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(postSaleFeeVaultBalance > startingFeeVaultBalance);

  // This is a Token pool without a shared escrow, so funds come from the pool.
  // Token pools do not get the mmFee.
  t.assert(postPoolBalance === prePoolBalance - poolConfig.startingPrice);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - price for the sale.
  t.assert(
    updatedPoolAccount.data.amount === depositAmount - poolConfig.startingPrice
  );
});

test('sell NFT into Token pool, wrong owner fails', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  const wrongOwner = await generateKeyPairSigner();
  coreTest.signers.poolOwner = wrongOwner;

  await testSell(t, coreTest, {
    brokerPayments: false,
    cosigner: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('it can sell an NFT into a Trade pool', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    feeVault,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useSharedEscrow: false,
    useMakerBroker: true,
    compoundFees: false,
    fundPool: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { poolConfig, price: minPrice, depositAmount } = testConfig;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the pool.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });

  // Fee vault balance increases.
  const postSaleFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(postSaleFeeVaultBalance > startingFeeVaultBalance);

  // This is a Trade pool without a shared escrow, so funds come from the pool.

  // Because this is a trade pool sell our starting price is shifted down one delta.
  const price = poolConfig.startingPrice - poolConfig.delta;

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = price;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Deposit Receipt should be created
  const [nftReceipt] = await findNftDepositReceiptPda({
    mint: asset.address,
    pool,
  });
  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    Account<NftDepositReceipt, Address>
  >{
    address: nftReceipt,
    data: {
      mint: asset.address,
      pool,
    },
  });
});

test('sell NFT into Trade pool, wrong owner fails', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  const wrongOwner = await generateKeyPairSigner();
  coreTest.signers.poolOwner = wrongOwner;

  await testSell(t, coreTest, {
    brokerPayments: false,
    cosigner: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('sell NFT into Token pool, pay brokers', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, coreTest, {
    brokerPayments: true,
    cosigner: false,
  });
});

test('sell NFT into Trade pool, pay brokers', async (t) => {
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, coreTest, {
    brokerPayments: true,
    cosigner: false,
  });
});

test('sell_nft_token_pool fails on trade pool', async (t) => {
  // Setup a Trade pool with funds.
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
  });

  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    coreTest;
  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Try to use the wrong instruction.
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('sell_nft_trade_pool fails on token pool', async (t) => {
  // Setup a Token pool with funds.
  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
  });

  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    coreTest;
  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Try to use the wrong instruction.
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('sell into Token pool, skip non-rent-exempt creators', async (t) => {
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

  let creators: Creator[] = creatorSigners.map(({ address }) => ({
    address,
    percentage: 20,
  }));

  // Set starting price low enough that the royalties don't push it above the rent exempt threshold.
  let config = structuredClone(tokenPoolConfig);
  config.startingPrice = 10000n;
  config.delta = config.startingPrice / 10n;

  const coreTest = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    creators,
    poolConfig: config,
    treeSize: 10_000,
    whitelistMode: Mode.MerkleTree,
  });

  const creatorStartingBalances = await Promise.all(
    creatorSigners.map((c) => getBalance(client, c.address))
  );

  await testSell(t, coreTest, {
    brokerPayments: false,
    cosigner: false,
    creators, // pass in the verified creators
    checkCreatorBalances: false,
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

test('it can sell an NFT into a Trade pool w/ an escrow account', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    sharedEscrow,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: true,
    compoundFees: false,
    fundPool: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { poolConfig, price: minPrice } = testConfig;

  // Starting balance of the shared escrow.
  const preSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    sharedEscrow,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  const postSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  // NFT is now owned by the pool.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });

  // This is a linear Trade pool with a shared escrow, so funds come from the escrow.
  //
  // Because this is a sell our starting price is shifted down one delta.
  const price = poolConfig.startingPrice - poolConfig.delta;

  // Compounding is off so the shared escrow loses the full price.
  const lamportsTaken = price;

  t.assert(postSharedEscrowBalance === preSharedEscrowBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Shared escrow pools should have an amount of 0.
  t.assert(updatedPoolAccount.data.amount === 0n);
});

test('token pool autocloses when currency amount drops below current price', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: true,
      useCosigner: true,
      compoundFees: false,
      fundPool: true,
      depositAmount: (tokenPoolConfig.startingPrice * 3n) / 2n, // 1.5x the starting price
    });

  const {
    cosigner,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = signers;
  const { poolConfig, price: minPrice } = testConfig;

  const startingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: poolOwner.address, // rent payer
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  // The amount left in the pool should be less than the current price so the pool should be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Remaining funds should be returned to the pool owner.
  const endingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  t.assert(
    startingPoolOwnerBalance <=
      endingPoolOwnerBalance + (poolBalance - poolConfig.startingPrice)
  );
});

test('token pool with shared escrow autocloses when shared escrow amount drops below current price', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    sharedEscrow,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useSharedEscrow: true,
    useMakerBroker: true,
    useCosigner: true,
    compoundFees: false,
    fundPool: false,
    depositAmount: (tokenPoolConfig.startingPrice * 3n) / 2n, // 1.5x the starting price
  });

  const {
    cosigner,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = signers;
  const { price: minPrice } = testConfig;

  const startingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: poolOwner.address, // rent payer
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
    sharedEscrow,
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

  // The amount left in the shared escrow should be less than the current price so the pool should be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Pool rent should be returned to the pool owner.
  const endingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  t.assert(startingPoolOwnerBalance <= endingPoolOwnerBalance + poolBalance);
});

test('token pool with shared escrow does not autoclose if shared escrow amount is above current price', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    sharedEscrow,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useSharedEscrow: true,
    useMakerBroker: true,
    useCosigner: true,
    compoundFees: false,
    fundPool: false,
    depositAmount: tokenPoolConfig.startingPrice * 3n, // 3x the starting price
  });

  const {
    cosigner,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = signers;
  const { poolConfig, price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: poolOwner.address, // rent payer
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
    sharedEscrow,
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

  // The amount left in the shared escrow is more than the current price so the pool should not be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === true);

  // Check that the shared escrow has more than the current price.
  const sharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;
  t.assert(sharedEscrowBalance > poolConfig.startingPrice);
});

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useCosigner: true,
      compoundFees: false,
      fundPool: true,
    });

  const { cosigner, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool

  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    cosigner,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(computeIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('sellNftTradePool emits self-cpi logging event', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useCosigner: true,
      compoundFees: false,
      fundPool: true,
    });

  const { cosigner, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(computeIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('sell NFT for FVC whitelist succeeds', async (t) => {
  const client = createDefaultSolanaClient();

  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const verifiedCreators: [VerifiedCreatorsArgs] = [
    {
      signatures: [
        {
          address: nftUpdateAuthority.address,
          verified: true,
        },
      ],
    },
  ];

  const plugins: PluginAuthorityPairArgs[] = [
    {
      plugin: {
        __kind: 'VerifiedCreators',
        fields: verifiedCreators,
      },
      authority: { __kind: 'UpdateAuthority' },
    },
  ];

  // Mint NFT w/ verified creators plugin
  const asset = await createAsset({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    plugins,
    name: 'Test',
    uri: 'https://test.com',
  });

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
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
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: owner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    asset: asset.address,
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
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });
});

test('sell NFT for VOC whitelist succeeds', async (t) => {
  const legacyTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    whitelistMode: Mode.VOC,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });
});

test('sell NFT for MerkleTree whitelist succeeds', async (t) => {
  const legacyTest = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    treeSize: 8,
    whitelistMode: Mode.MerkleTree,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });
});

test('sell for non-whitelisted NFT fails', async (t) => {
  const {
    client,
    testConfig,
    signers,
    asset: wlAsset,
    collection: wlCollection,
    whitelist,
    pool,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
    whitelistMode: Mode.VOC,
  });

  const { payer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Create a NFT that is not whitelisted, it will be the wrong collection.
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer,
    collectionAuthority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Non-whitelisted NFT and non-wl collection
  let sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION
  );

  // Non-whitelisted NFT + wl collection
  sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    asset: asset.address,
    collection: wlCollection.address,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Collection on asset doesn't match provided collection.
  await expectCustomError(t, promise, TENSOR_ERROR__INVALID_CORE_ASSET);

  // WL asset + non-wl collection
  sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    asset: wlAsset.address,
    collection: collection.address,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Collection on asset doesn't match provided collection.
  await expectCustomError(t, promise, TENSOR_ERROR__INVALID_CORE_ASSET);
});

test('fail to sell merkle proof whitelisted NFT into FVC pool', async (t) => {
  const {
    client,
    signers,
    pool: fvcPool,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    whitelistMode: Mode.FVC,
  });

  // Mint NFT
  const sellerFeeBasisPoints = 100;
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer: signers.nftUpdateAuthority,
    collectionAuthority: signers.nftUpdateAuthority,
    owner: signers.nftOwner.address,
    royalties: {
      creators: [
        {
          percentage: 100,
          address: signers.nftUpdateAuthority.address,
        },
      ],
      basisPoints: sellerFeeBasisPoints,
    },
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [asset.address]);
  const conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];

  // Create a whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: signers.nftUpdateAuthority,
    conditions,
  });

  const { mintProof } = await upsertMintProof({
    client,
    payer: signers.nftUpdateAuthority,
    mint: asset.address,
    whitelist,
    proof: p.proof,
  });

  // Try to sell our merkle tree whitelisted NFT into a FVC pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: signers.poolOwner.address,
    taker: signers.nftOwner,
    pool: fvcPool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    mintProof,
    minPrice: 0n,
    creators: [signers.nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('fail to sell merkle proof whitelisted NFT into VOC pool', async (t) => {
  const {
    client,
    signers,
    pool: fvcPool,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    whitelistMode: Mode.VOC,
  });

  // Mint NFT
  const sellerFeeBasisPoints = 100;
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer: signers.nftUpdateAuthority,
    collectionAuthority: signers.nftUpdateAuthority,
    owner: signers.nftOwner.address,
    royalties: {
      creators: [
        {
          percentage: 100,
          address: signers.nftUpdateAuthority.address,
        },
      ],
      basisPoints: sellerFeeBasisPoints,
    },
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [asset.address]);
  const conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];

  // Create a whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: signers.nftUpdateAuthority,
    conditions,
  });

  const { mintProof } = await upsertMintProof({
    client,
    payer: signers.nftUpdateAuthority,
    mint: asset.address,
    whitelist,
    proof: p.proof,
  });

  // Try to sell our merkle tree whitelisted NFT into a VOC pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: signers.poolOwner.address,
    taker: signers.nftOwner,
    pool: fvcPool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    mintProof,
    minPrice: 0n,
    creators: [signers.nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it can sell an NFT into a trade pool w/ set cosigner', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useCosigner: true,
      compoundFees: false,
      fundPool: true,
    });

  const { cosigner, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    whitelist: whitelist,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address],
    cosigner,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
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
});

test('it cannot sell an NFT into a trade pool incorrect cosigner', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useCosigner: true,
      compoundFees: false,
      fundPool: true,
    });

  const arbitraryCosigner = await generateKeyPairSigner();

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool without specififying cosigner
  const sellNftIxNoCosigner = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    whitelist,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  const promiseNoCosigner = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxNoCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseNoCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );

  // Sell NFT into pool with arbitraryCosigner
  const sellNftIxIncorrectCosigner =
    await getSellNftTradePoolCoreInstructionAsync({
      owner: poolOwner.address,
      taker: nftOwner,
      pool,
      asset: asset.address,
      collection: collection.address,
      whitelist,
      minPrice,
      creators: [nftUpdateAuthority.address],
      cosigner: arbitraryCosigner,
    });

  const promiseIncorrectCosigner = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxIncorrectCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseIncorrectCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );
});

test('it cannot sell an NFT into a trade pool w/ incorrect whitelist', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  // Mint Whitelist Authority
  const mintWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist: poolWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: mintWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: mintWhitelistAuthority,
    conditions: [{ mode: Mode.FVC, value: mintWhitelistAuthority.address }],
  });

  // Create pool w/ poolWhitelist as whitelist
  const { pool } = await createPool({
    client,
    whitelist: poolWhitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const sellerFeeBasisPoints = 100;

  // Mint NFT
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer,
    collectionAuthority: nftUpdateAuthority,
    owner: nftOwner.address,
    royalties: {
      creators: [
        {
          percentage: 100,
          address: nftUpdateAuthority.address,
        },
      ],
      basisPoints: sellerFeeBasisPoints,
    },
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool w/ specifying pool's whitelist & non-matching mint
  const sellNftIxPoolWL = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    whitelist: poolWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promisePoolWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxPoolWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promisePoolWL,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Sell NFT into pool w/ specifying mint's whitelist & non-matching pool
  const sellNftIxMintWL = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    whitelist: mintWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it can sell a NFT into a trade pool and pay the correct amount of royalties', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const creator = {
    address: nftUpdateAuthority.address,
    percentage: 100,
  } as Creator;

  const config = tradePoolConfig;

  const sellerFeeBasisPoints = 100;

  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer,
    collectionAuthority: nftUpdateAuthority,
    owner: nftOwner.address,
    royalties: {
      creators: [
        {
          percentage: 100,
          address: nftUpdateAuthority.address,
        },
      ],
      basisPoints: sellerFeeBasisPoints,
    },
  });

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: nftUpdateAuthority,
    conditions: [{ mode: Mode.VOC, value: collection.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Deposit sol into pool
  const depositIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    rentPayer: payer.address,
    pool,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    whitelist,
    // Remaining accounts
    creators: [creator.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
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

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Creator receives exactly the sellerFeeBasisPoints specified in pNFTs metadata of the buy price
  // postBalance === preBalance + bidPrice * sellerFeeBasisPoints / 100_00
  const endingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  t.assert(
    endingCreatorBalance ===
      startingCreatorBalance +
        (BigInt(sellerFeeBasisPoints) *
          BigInt(config.startingPrice - config.delta)) /
          100_00n
  );
});

test('pool owner cannot perform a sandwich attack on a seller on a Trade pool', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      fundPool: true,
    });

  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    asset: asset.address,
    collection: collection.address,
    minPrice, // exact price + mm_fees + royalties
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

  // Pool owner edits the pool right before the sell instruction is executed.
  // Actual sandwich attack would be separate transactions, but this demonstrates the point as it's
  // a more generous assumption in favor of the attacker.
  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstructions([editPoolIx, sellNftIx], tx),
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
    (tx) => appendTransactionMessageInstructions([editPoolIx, sellNftIx], tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should still fail with a price mismatch error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__PRICE_MISMATCH);
});

test('it can sell a NFT into a token pool w/ Merkle root whitelist', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    mintProof,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    whitelistMode: Mode.MerkleTree,
    useSharedEscrow: false,
    fundPool: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    asset: asset.address,
    collection: collection.address,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool owner.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: poolOwner.address,
    },
  });
});

test('it can sell a NFT into a trade pool w/ Merkle root whitelist', async (t) => {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    mintProof,
  } = await setupCoreTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    whitelistMode: Mode.MerkleTree,
    useSharedEscrow: false,
    fundPool: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    asset: asset.address,
    collection: collection.address,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
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
});

test('token pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, whitelist } =
    await setupCoreTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: true, // MakerBroker is set
      fundPool: true,
    });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  let sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTokenPoolCoreInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    asset: asset.address,
    collection: collection.address,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});
