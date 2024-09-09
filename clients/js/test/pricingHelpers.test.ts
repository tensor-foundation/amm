import test, { ExecutionContext } from 'ava';
import { ONE_SOL, setupLegacyTest, TestAction } from './_common';
import {
  PoolType,
  getCurrentAskPrice,
  getCurrentBidPrice,
  fetchPool,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  CurveType,
  PoolConfig,
  getSellNftTokenPoolInstructionAsync,
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

/*test('getCurrentBidPrice matches on-chain price for Token pool', async (t) => {
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
    testConfig: { poolConfig: { startingPrice } }
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
});*/

/*test('Linear pool pricing after 20 sells', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 10n * ONE_SOL,
    delta: 147_000_000n, // 0.147 sol delta
    mmCompoundFees: false,
    mmFeeBps: null,
  }
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config
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
  const nfts = [];
  for (let i = 0; i < 20; i++) {
    const nft = await createDefaultNft({
      client,
      payer: nftOwner,
      authority: nftUpdateAuthority,
      owner: nftOwner,
    });
    nfts.push(nft);
  }

  // Sell NFTs into the pool
  await sellNftsIntoPool(t, client, pool, nfts, poolOwner, nftOwner, whitelist, PoolType.Token, [nftUpdateAuthority.address]);

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerSellCount, 20);
});*/

test('Exponential pool pricing after 20 sells', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 10n * ONE_SOL,
    delta: 14_40n, // 14.4%  delta
    mmCompoundFees: false,
    mmFeeBps: 458, // 4.58% mmFeeBps
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;

  // Deposit a large amount of SOL into the pool
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
      payer: nftOwner,
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
  const originalPoolAccount = await fetchPool(client.rpc, pool);
  let lastPoolAmountBeforeSale = 0n;
  let lastCalculatedTakerPrice = 0n;
  let lastCalculatedMakerPrice = 0n;
  for (const nft of nfts) {
    const poolAccount = await fetchPool(client.rpc, pool);
    t.log(`pool account offset: ${poolAccount.data.priceOffset}`);

    // Check that last sale deducted the exact amount of lamports
    if (i !== 0) {
      t.log(
        `lastCalcPriceTaker: ${BigInt(lastCalculatedTakerPrice)}, lastCalcPriceMaker: ${lastCalculatedMakerPrice}, pool lamports: ${poolAccount.data.amount}, last pool amount before sale: ${lastPoolAmountBeforeSale}`
      );
      t.assert(
        lastCalculatedMakerPrice + poolAccount.data.amount ===
          lastPoolAmountBeforeSale
      );
    }

    // Next prices:
    // One step price calculation
    const calculatedPrice = await getCurrentBidPrice(
      client.rpc,
      poolAccount.data
    );
    // Multiple steps (extra offset) from original pool account data - should match
    const predictedPrice = await getCurrentBidPrice(
      client.rpc,
      originalPoolAccount.data,
      i
    );
    //t.log(poolAccount.data.priceOffset)
    t.log(`calculatedPrice: ${calculatedPrice}`);
    t.log(`predicted price: ${predictedPrice}`);
    t.assert(calculatedPrice === predictedPrice);

    if (calculatedPrice === null) {
      t.fail('Calculated price is null');
    }
    lastPoolAmountBeforeSale = poolAccount.data.amount;
    lastCalculatedTakerPrice = BigInt(calculatedPrice);
    lastCalculatedMakerPrice =
      (BigInt(lastCalculatedTakerPrice) * 100_00n) /
      (100_00n - BigInt(poolAccount.data.config.mmFeeBps ?? 0));

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
