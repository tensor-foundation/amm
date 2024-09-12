import test, { ExecutionContext } from 'ava';
import { ONE_SOL, setupLegacyTest, TestAction } from './_common';
import {
  PoolType,
  getCurrentBidPrice,
  fetchPool,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  CurveType,
  PoolConfig,
  getSellNftTokenPoolInstructionAsync,
  getCurrentAskPrice,
  getDepositNftInstructionAsync,
  getBuyNftInstructionAsync,
} from '../src';
import {
  signAndSendTransaction,
  createDefaultTransaction,
  Client,
} from '@tensor-foundation/test-helpers';
import {
  Address,
  appendTransactionMessageInstruction,
  KeyPairSigner,
  pipe,
} from '@solana/web3.js';
import { createDefaultNft, Nft } from '@tensor-foundation/mpl-token-metadata';

test('getCurrentBidPrice matches on-chain price for Token pool', async (t) => {
  const { client, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  const onChainBidPrice = poolAccount.data.config.startingPrice;
  const calculatedBidPrice = await getCurrentBidPrice(
    client.rpc,
    poolAccount.data
  );

  t.assert(calculatedBidPrice === Number(onChainBidPrice));
});

test('getCurrentAskPrice returns null for empty NFT pool', async (t) => {
  const { client, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Sell,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  const calculatedAskPrice = getCurrentAskPrice(poolAccount.data);

  t.assert(calculatedAskPrice === null);
});

test('getCurrentBidPrice handles shared escrow correctly', async (t) => {
  const { client, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useSharedEscrow: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  const calculatedBidPrice = await getCurrentBidPrice(
    client.rpc,
    poolAccount.data
  );

  t.assert(
    typeof calculatedBidPrice === 'number' || calculatedBidPrice === null
  );
});

test('getCurrentBidPrice takes rent exemption into account', async (t) => {
  const {
    client,
    pool,
    signers: { poolOwner },
    testConfig: {
      poolConfig: { startingPrice },
    },
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    depositAmount: 0n,
  });

  let poolAccount = await fetchPool(client.rpc, pool);

  // Deposit SOL into the pool, 1 lamport less than the current price
  const depositAmount = BigInt(startingPrice) - 1n;
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Fetch the updated pool account
  poolAccount = await fetchPool(client.rpc, pool);

  // Get the calculated bid price
  let calculatedBidPrice = await getCurrentBidPrice(
    client.rpc,
    poolAccount.data
  );
  // Assert that the calculated bid price is null
  t.is(calculatedBidPrice, null);

  // Deposit one more lamport
  const additionalDepositIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 1n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(additionalDepositIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Fetch the updated pool account again
  poolAccount = await fetchPool(client.rpc, pool);

  // Get the new calculated bid price
  calculatedBidPrice = await getCurrentBidPrice(client.rpc, poolAccount.data);

  // Assert that the calculated bid price is now a number
  t.true(typeof calculatedBidPrice === 'number');

  // Assert that the calculated bid price matches the expected value
  t.is(calculatedBidPrice, Number(startingPrice));
});

test('Linear pool pricing after 20 sells', async (t) => {
  t.timeout(60000);
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 10n * ONE_SOL,
    delta: 147_000_000n, // 0.147 sol delta
    mmCompoundFees: false,
    mmFeeBps: null,
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;

  const depositAmount = 500n * ONE_SOL;
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint 20 NFTs
  let nfts = [];
  const nftPromises = [];
  for (let i = 0; i < 20; i++) {
    const nft = createDefaultNft({
      client,
      payer: poolOwner,
      authority: nftUpdateAuthority,
      owner: nftOwner,
    });
    nftPromises.push(nft);
  }
  nfts = await Promise.all(nftPromises);

  // Sell NFTs into the pool
  await sellNftsIntoPool(
    t,
    client,
    pool,
    nfts,
    poolOwner,
    nftOwner,
    whitelist,
    PoolType.Token,
    [nftUpdateAuthority.address]
  );

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerSellCount, 20);
});

test('Exponential pool pricing after 20 sells', async (t) => {
  t.timeout(60000);
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 67362869n,
    delta: 14_40n, // 14.4%  delta
    mmCompoundFees: false,
    mmFeeBps: 458, // 4.58% mmFeeBps
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    fundPool: false,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;

  // Deposit a large amount of SOL into the pool
  const depositAmount = 800n * ONE_SOL;
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint 20 NFTs
  let nfts = [];
  const nftPromises = [];
  for (let i = 0; i < 20; i++) {
    const nft = createDefaultNft({
      client,
      payer: poolOwner,
      authority: nftUpdateAuthority,
      owner: nftOwner,
    });
    nftPromises.push(nft);
  }
  nfts = await Promise.all(nftPromises);

  // Sell NFTs into the pool
  await sellNftsIntoPool(
    t,
    client,
    pool,
    nfts,
    poolOwner,
    nftOwner,
    whitelist,
    PoolType.Trade,
    [nftUpdateAuthority.address]
  );

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerSellCount, 20);
});

test('Exponential pool pricing speed test', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 67362869n,
    delta: 2_43n, // 2.34%  delta
    mmCompoundFees: false,
    mmFeeBps: 458, // 4.58% mmFeeBps
  };
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    fundPool: false,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner } = signers;

  // Deposit a large amount of SOL into the pool
  const depositAmount = 800n * ONE_SOL;
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const poolData = (await fetchPool(client.rpc, pool)).data;
  const start = performance.now();
  for (let i = 0; i <= 1000; i++) {
    getCurrentBidPrice(client.rpc, poolData, i);
  }
  const end = performance.now();
  t.log(
    `calculting the 1000 next exponential pool prices took ${end - start} ms.`
  );

  t.pass();
});

test('Linear pool pricing after 30 buys', async (t) => {
  t.timeout(60000);
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 4n * ONE_SOL,
    delta: 147_000_000n, // 0.147 sol delta
    mmCompoundFees: false,
    mmFeeBps: 5,
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;

  // Mint and deposit 30 NFTs into the pool
  const nfts = await mintAndDepositNfts(
    client,
    pool,
    poolOwner,
    nftUpdateAuthority,
    whitelist,
    30
  );

  await buyNftsFromPool(t, client, pool, nfts, poolOwner, nftOwner, [
    nftUpdateAuthority.address,
  ]);

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerBuyCount, 30);
});

test('Exponential pool pricing after 30 buys', async (t) => {
  t.timeout(60000);
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 154_218_090_823n,
    delta: 4_71n,
    mmCompoundFees: false,
    mmFeeBps: 5,
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    fundPool: false,
    signerFunds: 20_000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner: buyer, nftUpdateAuthority } = signers;

  // Mint and deposit 30 NFTs into the pool
  const nfts = await mintAndDepositNfts(
    client,
    pool,
    poolOwner,
    nftUpdateAuthority,
    whitelist,
    30
  );

  await buyNftsFromPool(t, client, pool, nfts, poolOwner, buyer, [
    nftUpdateAuthority.address,
  ]);

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerBuyCount, 30);
});

///////////////////////////////////////////////////////////////////////////////////
////////////////////////////// test specific helpers //////////////////////////////
///////////////////////////////////////////////////////////////////////////////////

async function mintAndDepositNfts(
  client: Client,
  pool: Address,
  poolOwner: KeyPairSigner,
  nftUpdateAuthority: KeyPairSigner,
  whitelist: Address,
  count: number
): Promise<Nft[]> {
  // Create NFTs asynchronously
  const nftPromises = Array(count)
    .fill(null)
    .map(() =>
      createDefaultNft({
        client,
        payer: poolOwner,
        authority: nftUpdateAuthority,
        owner: poolOwner,
      })
    );

  const nfts = await Promise.all(nftPromises);

  // Deposit NFTs asynchronously
  const depositPromises = nfts.map(async (nft) => {
    const depositNftIx = await getDepositNftInstructionAsync({
      owner: poolOwner,
      pool,
      whitelist,
      mint: nft.mint,
    });

    return pipe(
      await createDefaultTransaction(client, poolOwner),
      (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  });

  await Promise.all(depositPromises);

  return nfts;
}

async function buyNftsFromPool(
  t: ExecutionContext,
  client: Client,
  pool: Address,
  nfts: Nft[],
  poolOwner: KeyPairSigner,
  buyer: KeyPairSigner,
  creators: Address[]
) {
  let i = 0;
  let lastPoolAmountBeforeSale = 0n;
  let lastCalculatedPrice = 0;
  for (const nft of nfts) {
    const poolAccount = await fetchPool(client.rpc, pool);
    let currentPrice = getCurrentAskPrice(poolAccount.data);

    if (i !== 0) {
      // assert last calculated price was within 1 lamport of the actual price
      t.assert(
        poolAccount.data.amount - BigInt(lastCalculatedPrice) <=
          lastPoolAmountBeforeSale &&
          lastPoolAmountBeforeSale <=
            poolAccount.data.amount - BigInt(lastCalculatedPrice) + 1n
      );
    }
    if (currentPrice === null) {
      t.fail('Current price is null');
    }
    lastPoolAmountBeforeSale = poolAccount.data.amount;
    lastCalculatedPrice = currentPrice;

    const buyNftIx = await getBuyNftInstructionAsync({
      owner: poolOwner.address,
      buyer: buyer,
      pool,
      mint: nft.mint,
      maxAmount: BigInt(currentPrice),
      creators,
    });

    await pipe(
      await createDefaultTransaction(client, buyer),
      (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
    i += 1;
  }
}

async function sellNftsIntoPool(
  t: ExecutionContext,
  client: Client,
  pool: Address,
  nfts: Nft[],
  poolOwner: KeyPairSigner,
  nftOwner: KeyPairSigner,
  whitelist: Address,
  poolType: PoolType,
  creators: Address[]
) {
  let i = 0;
  let lastPoolAmountBeforeSale = 0n;
  let lastCalculatedMakerPrice = 0n;
  for (const nft of nfts) {
    const poolAccount = await fetchPool(client.rpc, pool);

    // Check that last sale deducted the exact amount of lamports
    if (i !== 0) {
      t.assert(
        lastCalculatedMakerPrice + poolAccount.data.amount ===
          lastPoolAmountBeforeSale
      );
    }
    const calculatedPrice = await getCurrentBidPrice(
      client.rpc,
      poolAccount.data
    );
    const calculatedMakerPrice = await getCurrentBidPrice(
      client.rpc,
      poolAccount.data,
      undefined,
      false
    );

    if (calculatedPrice === null || calculatedMakerPrice === null) {
      t.fail('Calculated price is null');
    }
    lastPoolAmountBeforeSale = poolAccount.data.amount;
    lastCalculatedMakerPrice = BigInt(calculatedMakerPrice);

    const sellNftIx =
      poolType === PoolType.Trade
        ? await getSellNftTradePoolInstructionAsync({
            owner: poolOwner.address,
            seller: nftOwner,
            pool,
            mint: nft.mint,
            minPrice: BigInt(calculatedPrice),
            whitelist,
            creators,
          })
        : await getSellNftTokenPoolInstructionAsync({
            owner: poolOwner.address,
            seller: nftOwner,
            pool,
            mint: nft.mint,
            minPrice: BigInt(calculatedPrice),
            whitelist,
            creators,
          });

    await pipe(
      await createDefaultTransaction(client, nftOwner),
      (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
    i += 1;
  }
}
