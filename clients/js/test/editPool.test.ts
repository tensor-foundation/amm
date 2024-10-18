import {
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  TokenStandard,
  createDefaultNftInCollection,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  ONE_SOL,
  createDefaultSolanaClient,
  createDefaultTransaction,
  expectCustomError,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Mode,
  WhitelistV2,
  fetchWhitelistV2,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  PoolType,
  TENSOR_AMM_ERROR__DELTA_TOO_LARGE,
  TENSOR_AMM_ERROR__FEES_NOT_ALLOWED,
  TENSOR_AMM_ERROR__FEES_TOO_HIGH,
  TENSOR_AMM_ERROR__MAX_TAKER_SELL_COUNT_TOO_SMALL,
  TENSOR_AMM_ERROR__WRONG_POOL_TYPE,
  fetchPool,
  findNftDepositReceiptPda,
  getCurrentBidPriceSync,
  getEditPoolInstruction,
  getSellNftTradePoolInstructionAsync,
} from '../src/index.js';
import {
  MAX_DELTA_BPS,
  MAX_MM_FEES_BPS,
  ONE_WEEK,
  TestAction,
  createPool,
  createWhitelistV2,
  nftPoolConfig,
  tokenPoolConfig,
  tradePoolConfig,
} from './_common.js';
import { setupLegacyTest, testSell } from './legacy/_common.js';

test('can edit pool with new config', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig = structuredClone(nftPoolConfig);
  newConfig.curveType = CurveType.Exponential;
  newConfig.startingPrice = 1000000000n;
  newConfig.delta = 10n;

  const editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.like(await fetchPool(client.rpc, pool), {
    data: {
      config: newConfig,
    },
  });
});

test('can edit pool with new cosigner', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newCosigner = (await generateKeyPairSigner()).address;

  const editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    cosigner: newCosigner,
    newConfig: null,
    resetPriceOffset: false,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.like(await fetchPool(client.rpc, pool), {
    data: {
      cosigner: newCosigner,
    },
  });
});

test('it can edit a pool w/ a new expiry date', async (t) => {
  const client = createDefaultSolanaClient();
  const updateAuthority = await generateKeyPairSignerWithSol(client);
  const freezeAuthority = (await generateKeyPairSigner()).address;
  const namespace = await generateKeyPairSigner();
  const voc = (await generateKeyPairSigner()).address;

  // Setup a basic whitelist to use with the pool.
  const conditions = [
    { mode: Mode.FVC, value: updateAuthority.address },
    { mode: Mode.VOC, value: voc },
  ];

  const { whitelist, uuid } = await createWhitelistV2({
    client,
    updateAuthority,
    freezeAuthority,
    conditions,
    namespace,
  });

  // Then a whitelist was created with the correct data.
  t.like(await fetchWhitelistV2(client.rpc, whitelist), <WhitelistV2>(<unknown>{
    address: whitelist,
    data: {
      updateAuthority: updateAuthority.address,
      namespace: namespace.address,
      freezeAuthority,
      uuid,
      conditions,
    },
  }));

  // Create default pool
  const { pool } = await createPool({
    client,
    whitelist,
    owner: updateAuthority,
    expireInSec: ONE_WEEK,
  });

  const editPoolIx = getEditPoolInstruction({
    owner: updateAuthority,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    cosigner: null,
    maxTakerSellCount: null,
    resetPriceOffset: true,
  });

  await pipe(
    await createDefaultTransaction(client, updateAuthority),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolAccount = await fetchPool(client.rpc, pool);

  const expectedTimestampSecs = BigInt(Math.floor(Date.now() / 1000));
  const expiryDifference =
    poolAccount.data.expiry - (expectedTimestampSecs + BigInt(2 * ONE_WEEK));

  t.assert(expiryDifference < 10n && expiryDifference > -10n);
});

test('cannot change pool type', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig = structuredClone(nftPoolConfig);
  newConfig.poolType = PoolType.Token;

  const editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('cannot set mm fee bps on a non-trade pool', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig = structuredClone(nftPoolConfig);
  newConfig.curveType = CurveType.Exponential;
  newConfig.startingPrice = 1000000000n;
  newConfig.delta = 10n;
  newConfig.mmFeeBps = 1000;

  const editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__FEES_NOT_ALLOWED);

  const {
    client: client2,
    pool: pool2,
    signers: signers2,
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig2 = structuredClone(tokenPoolConfig);
  newConfig2.curveType = CurveType.Exponential;
  newConfig2.startingPrice = 1000000000n;
  newConfig2.delta = 10n;
  newConfig2.mmFeeBps = 1000;

  const editPoolIx2 = getEditPoolInstruction({
    owner: signers2.poolOwner,
    pool: pool2,
    expireInSec: 2 * ONE_WEEK,
    newConfig: newConfig2,
    resetPriceOffset: false,
  });

  const promise2 = pipe(
    await createDefaultTransaction(client2, signers2.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx2, tx),
    (tx) => signAndSendTransaction(client2, tx)
  );

  await expectCustomError(t, promise2, TENSOR_AMM_ERROR__FEES_NOT_ALLOWED);
});

test('cannot set mm fee bps higher than MAX_MM_FEES_BPS on trade pool', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig = structuredClone(tradePoolConfig);
  newConfig.mmFeeBps = MAX_MM_FEES_BPS + 1;

  const editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__FEES_TOO_HIGH);
});

test('exponential curve delta must be less than 99.99%', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const newConfig = structuredClone(nftPoolConfig);
  newConfig.curveType = CurveType.Exponential;
  newConfig.startingPrice = 1000000000n;
  newConfig.delta = MAX_DELTA_BPS + 1n;

  let editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__DELTA_TOO_LARGE);

  newConfig.delta = MAX_DELTA_BPS;

  editPoolIx = getEditPoolInstruction({
    owner: signers.poolOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.like(await fetchPool(client.rpc, pool), {
    data: {
      config: newConfig,
    },
  });
});

test('correctly handles maxTakerSellCount', async (t) => {
  t.timeout(30_000);
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    depositAmount: 5n * ONE_SOL,
    signerFunds: 10n * ONE_SOL,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });

  t.like(await fetchPool(legacyTest.client.rpc, legacyTest.pool), {
    data: {
      maxTakerSellCount: 0,
      stats: {
        takerSellCount: 1,
        takerBuyCount: 0,
      },
    },
  });

  // Mint NFT
  const { item: nftB } = await createDefaultNftInCollection({
    client: legacyTest.client,
    payer: legacyTest.signers.poolOwner,
    authority: legacyTest.signers.nftUpdateAuthority,
    owner: legacyTest.signers.poolOwner.address,
    standard: TokenStandard.NonFungible,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({
    mint: nftB.mint,
    pool: legacyTest.pool,
  });

  const sellerFeeBasisPoints = await fetchMetadata(
    legacyTest.client.rpc,
    nftB.metadata
  ).then((metadata) => metadata.data.sellerFeeBasisPoints);

  const poolAccount = await fetchPool(legacyTest.client.rpc, legacyTest.pool);

  const currentPrice = getCurrentBidPriceSync({
    pool: poolAccount.data,
    availableLamports: poolAccount.data.amount,
    royaltyFeeBps: sellerFeeBasisPoints,
    extraOffset: 0,
    excludeMMFee: false,
  });

  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: legacyTest.signers.poolOwner.address,
    taker: legacyTest.signers.poolOwner,
    pool: legacyTest.pool,
    mint: nftB.mint,
    minPrice: currentPrice ?? 0n,
    optionalRoyaltyPct: 100,
    whitelist: legacyTest.whitelist,
    nftReceipt,
    creators: [legacyTest.signers.nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.poolOwner
    ),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  t.like(await fetchPool(legacyTest.client.rpc, legacyTest.pool), {
    data: {
      maxTakerSellCount: 0,
      stats: {
        takerSellCount: 2,
        takerBuyCount: 0,
      },
    },
  });

  let editPoolIx = getEditPoolInstruction({
    owner: legacyTest.signers.poolOwner,
    pool: legacyTest.pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    maxTakerSellCount: 10, // we can update this value
    resetPriceOffset: false,
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.poolOwner
    ),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  t.like(await fetchPool(legacyTest.client.rpc, legacyTest.pool), {
    data: {
      maxTakerSellCount: 10,
    },
  });

  // Cannot update to < taker_sell_count - taker_buy_count
  editPoolIx = getEditPoolInstruction({
    owner: legacyTest.signers.poolOwner,
    pool: legacyTest.pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    maxTakerSellCount: 1,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.poolOwner
    ),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_AMM_ERROR__MAX_TAKER_SELL_COUNT_TOO_SMALL
  );

  // But can set to 0, which means no restriction
  editPoolIx = getEditPoolInstruction({
    owner: legacyTest.signers.poolOwner,
    pool: legacyTest.pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    maxTakerSellCount: 0,
    resetPriceOffset: false,
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.poolOwner
    ),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );
});

test('can reset price offset', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    depositAmount: 5n * ONE_SOL,
    signerFunds: 10n * ONE_SOL,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });

  t.like(await fetchPool(legacyTest.client.rpc, legacyTest.pool), {
    data: {
      priceOffset: -1,
      stats: {
        takerSellCount: 1,
        takerBuyCount: 0,
      },
    },
  });

  const editPoolIx = getEditPoolInstruction({
    owner: legacyTest.signers.poolOwner,
    pool: legacyTest.pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig: null,
    resetPriceOffset: true,
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.poolOwner
    ),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  t.like(await fetchPool(legacyTest.client.rpc, legacyTest.pool), {
    data: {
      priceOffset: 0,
      stats: {
        takerSellCount: 1,
        takerBuyCount: 0,
      },
    },
  });
});

test('invalid owner cannot edit pool', async (t) => {
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const invalidOwner = await generateKeyPairSignerWithSol(client);

  const newConfig = structuredClone(nftPoolConfig);
  newConfig.curveType = CurveType.Exponential;
  newConfig.startingPrice = 1000000000n;

  const editPoolIx = getEditPoolInstruction({
    owner: invalidOwner,
    pool,
    expireInSec: 2 * ONE_WEEK,
    newConfig,
    resetPriceOffset: false,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(editPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});
