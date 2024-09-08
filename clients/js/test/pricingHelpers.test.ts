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

test('getCurrentBidPrice matches on-chain price for Trade pool', async (t) => {
  const { client, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  const onChainBidPrice =
    poolAccount.data.config.startingPrice - poolAccount.data.config.delta;
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
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    depositAmount: 0n,
  });

  let poolAccount = await fetchPool(client.rpc, pool);
  t.log(poolAccount.data.amount);
  // Calculate the current price
  const currentPrice =
    poolAccount.data.config.startingPrice - poolAccount.data.config.delta;

  // Deposit SOL into the pool, 1 lamport less than the current price
  const depositAmount = BigInt(currentPrice) - 1n;
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
  t.is(calculatedBidPrice, Number(currentPrice));
});

test('Linear pool pricing after 50 sells', async (t) => {
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    curveType: CurveType.Linear,
    signerFunds: 1000n * ONE_SOL,
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

  // Mint 50 NFTs
  const nfts = [];
  for (let i = 0; i < 50; i++) {
    const nft = await createDefaultNft({
      client,
      payer: nftOwner,
      authority: nftUpdateAuthority,
      owner: nftOwner,
    });
    nfts.push(nft);
  }

  // Sell NFTs into the pool
  await sellNftsIntoPool(t, client, pool, nfts, poolOwner, nftOwner, whitelist);

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerSellCount, 50);
});

test('Exponential pool pricing after 50 sells', async (t) => {
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    curveType: CurveType.Exponential,
    signerFunds: 1000n * ONE_SOL,
    delta: 20_00n, // 20% per sale
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

  // Mint 50 NFTs
  const nfts = [];
  for (let i = 0; i < 50; i++) {
    const nft = await createDefaultNft({
      client,
      payer: nftOwner,
      authority: nftUpdateAuthority,
      owner: nftOwner,
    });
    nfts.push(nft);
  }

  // Sell NFTs into the pool
  await sellNftsIntoPool(t, client, pool, nfts, poolOwner, nftOwner, whitelist);

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerSellCount, 50);
});

async function sellNftsIntoPool(
  t: ExecutionContext,
  client: Client,
  pool: Address,
  nfts: Nft[],
  poolOwner: KeyPairSigner,
  nftOwner: KeyPairSigner,
  whitelist: Address
) {
  let i = 0;
  const originalPoolAccount = await fetchPool(client.rpc, pool);
  let lastPoolAmountBeforeSale = 0n;
  let lastCalculatedPrice = 0;
  for (const nft of nfts) {
    i += 1;
    const poolAccount = await fetchPool(client.rpc, pool);

    // Check that last sale deducted the exact amount of lamports
    if (i !== 0)
      t.assert(
        BigInt(lastCalculatedPrice) + poolAccount.data.amount ===
          lastPoolAmountBeforeSale
      );

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
    t.assert(calculatedPrice === predictedPrice);

    if (calculatedPrice === null) {
      t.fail('Calculated price is null');
    }
    lastPoolAmountBeforeSale = poolAccount.data.amount;
    lastCalculatedPrice = calculatedPrice;

    const sellNftIx = await getSellNftTradePoolInstructionAsync({
      owner: poolOwner.address,
      seller: nftOwner,
      pool,
      mint: nft.mint,
      minPrice: BigInt(calculatedPrice),
      whitelist,
    });

    try {
      await pipe(
        await createDefaultTransaction(client, nftOwner),
        (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );
    } catch (error) {
      t.fail(`Failed to sell NFT: ${error}`);
    }
  }
}
