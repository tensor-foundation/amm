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
    startingPrice: 1_000_000_000n,
    delta: 0n, // 14.4%  delta
    mmCompoundFees: false,
    mmFeeBps: 500, // 4.58% mmFeeBps
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
    `calculating the 1000 next exponential pool prices took ${end - start} ms.`
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
    startingPrice: 218_090_823n,
    delta: 19_71n,
    mmCompoundFees: false,
    mmFeeBps: 5,
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    fundPool: false,
    signerFunds: 5_000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner: buyer, nftUpdateAuthority } = signers;

  // Mint and deposit 300 NFTs into the pool
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

    return await pipe(
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
    const currentPrice = getCurrentAskPrice(poolAccount.data);
    if (i !== 0) {
      // assert last calculated price exactly matched actual price
      t.assert(
        poolAccount.data.amount -
          lastPoolAmountBeforeSale -
          BigInt(lastCalculatedPrice) ===
          0n
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
//
    //const poolAccountAfter = await fetchPool(client.rpc, pool);
    //t.log(`startingPrice: ${poolAccount.data.config.startingPrice}`);
    //t.log(`poolType: ${poolAccount.data.config.poolType} (0=token, 1=nft, 2=trade)`)
    //t.log(`current calculated price (without MM Fee): ${lastCalculatedPrice} (offset: ${poolAccount.data.priceOffset})`);
    //t.log(`pool amount b4 sale: ${lastPoolAmountBeforeSale}, pool amount after sale: ${poolAccountAfter.data.amount}, price received by pool: ${poolAccountAfter.data.amount-lastPoolAmountBeforeSale}`)
    //t.log(`price paid by pool === currentPrice used in ix? : ${poolAccountAfter.data.amount-lastPoolAmountBeforeSale === BigInt(lastCalculatedPrice)}`);
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
  for (const nft of nfts) {
    const sellerBefore = await client.rpc.getBalance(nftOwner.address).send();
    const poolAccountBefore = await fetchPool(client.rpc, pool);
    const calculatedTakerPrice = await getCurrentBidPrice(
      client.rpc,
      poolAccountBefore.data
    )
    const calculatedMakerPrice = await getCurrentBidPrice(
      client.rpc,
      poolAccountBefore.data,
      undefined,
      true
    );

    if (calculatedMakerPrice === null || calculatedTakerPrice === null) {
      t.fail('Calculated price is null');
    }
    const sellNftIx =
      poolType === PoolType.Trade
        ? await getSellNftTradePoolInstructionAsync({
            owner: poolOwner.address,
            seller: nftOwner,
            pool,
            mint: nft.mint,
            minPrice: BigInt(calculatedTakerPrice),
            whitelist,
            creators,
          })
        : await getSellNftTokenPoolInstructionAsync({
            owner: poolOwner.address,
            seller: nftOwner,
            pool,
            mint: nft.mint,
            minPrice: BigInt(calculatedTakerPrice),
            whitelist,
            creators,
          });

    await pipe(
      await createDefaultTransaction(client, nftOwner),
      (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
    const sellerAfter = await client.rpc.getBalance(nftOwner.address).send();
    const poolAccountAfter = await fetchPool(client.rpc, pool);
    const poolDiff = (poolAccountAfter.data.amount - poolAccountBefore.data.amount) * -1n;
    let sellerDiff = sellerAfter.value - sellerBefore.value;
    sellerDiff += 5000n // account for base transaction fees (5k lamports) 
    sellerDiff += BigInt(2 * calculatedMakerPrice / 1_00); // account for taker fees 
    t.log(`calculated maker price: ${calculatedMakerPrice}, calculated taker price: ${calculatedTakerPrice}, pool difference: ${poolDiff}, seller diff: ${sellerDiff}, pool diff - seller diff: ${poolDiff - sellerDiff}`);
    t.assert(BigInt(calculatedTakerPrice) === sellerDiff);
    t.assert(BigInt(calculatedMakerPrice) === poolDiff);
  }
}
