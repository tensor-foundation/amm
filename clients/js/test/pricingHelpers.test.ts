import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Address,
  appendTransactionMessageInstruction,
  KeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  getDepositMarginAccountInstructionAsync,
  TENSOR_ESCROW_PROGRAM_ADDRESS,
} from '@tensor-foundation/escrow';
import { createDefaultNft, Nft } from '@tensor-foundation/mpl-token-metadata';
import {
  Client,
  createDefaultTransaction,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import test, { ExecutionContext } from 'ava';
import {
  calculateAmountForQuantity,
  calculatePrice,
  CurveType,
  fetchPool,
  getAmountOfBids,
  getBuyNftInstructionAsync,
  getCurrentAskPrice,
  getCurrentBidPrice,
  getDepositNftInstructionAsync,
  getDepositSolInstruction,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
  PoolConfig,
  PoolType,
  TakerSide,
} from '../src';
import {
  COMPUTE_500K_IX,
  expectCustomError,
  ONE_SOL,
  TestAction,
} from './_common';
import { setupLegacyTest } from './legacy/_common';

test('getCurrentAskPrice returns null for empty NFT pool', async (t) => {
  const { client, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Sell,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  const calculatedAskPrice = getCurrentAskPrice({
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });

  t.assert(calculatedAskPrice === null);
});

test('getCurrentBidPrice handles shared escrow correctly', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Exponential,
    startingPrice: 2_145_000_045n,
    delta: 14_40n, // 14.4%  delta
    mmCompoundFees: false,
    mmFeeBps: null, // 4.58% mmFeeBps
  };
  const {
    client,
    pool,
    signers: { poolOwner, nftOwner, nftUpdateAuthority },
    testConfig: {
      poolConfig: { startingPrice },
    },
    nft,
    whitelist,
    sharedEscrow: marginAccount,
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    useSharedEscrow: true,
    useMakerBroker: false,
    action: TestAction.Sell,
    depositAmount: 0n,
    poolConfig: config,
  });

  let poolAccount = await fetchPool(client.rpc, pool);

  // Deposit SOL into the pool, 1 lamport less than the current price,
  // setupLegacyTest deposits 1 sol into escrow by default
  const depositAmount = BigInt(startingPrice) - 1n - 1n * ONE_SOL;
  const depositSolIx = await getDepositMarginAccountInstructionAsync({
    owner: poolOwner,
    marginAccount,
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
  let calculatedBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });
  // Assert that the calculated bid price is null
  t.is(calculatedBidPrice, null);

  // get theoretical bid price
  const theoreticalBidPrice = calculatePrice({
    pool: poolAccount.data,
    side: TakerSide.Sell,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });

  const cuLimitIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  // Then we expect the sell ix to fail due to not enough funds
  let sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint: nft.mint,
    minPrice: BigInt(theoreticalBidPrice),
    whitelist,
    sharedEscrow: marginAccount,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  const promiseSellTx = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promiseSellTx, 15002);

  // Deposit one more lamport
  const additionalDepositIx = await getDepositMarginAccountInstructionAsync({
    owner: poolOwner,
    marginAccount,
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
  calculatedBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });

  // Assert that the calculated bid price is now a number
  t.true(typeof calculatedBidPrice === 'number');

  // And then we expect the transaction to succeed
  sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint: nft.mint,
    minPrice: BigInt(theoreticalBidPrice),
    whitelist,
    sharedEscrow: marginAccount,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
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
  let calculatedBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });
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
  calculatedBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    extraOffset: 0,
  });

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
    useMakerBroker: false,
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
      owner: nftOwner.address,
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
    delta: 14_40n, // 14.4%  delta
    mmCompoundFees: false,
    mmFeeBps: 4_58, // 4.58% mmFeeBps
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    fundPool: false,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
    useMakerBroker: false,
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
      owner: nftOwner.address,
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
    useMakerBroker: false,
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
    getCurrentBidPrice({
      rpc: client.rpc,
      pool: poolData,
      royaltyFeeBps: 0,
      extraOffset: i,
    });
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
    poolType: PoolType.NFT,
    curveType: CurveType.Linear,
    startingPrice: 4n * ONE_SOL,
    delta: 147_000_000n, // 0.147 sol delta
    mmCompoundFees: false,
    mmFeeBps: null,
  };
  const { client, pool, signers, whitelist } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
    useMakerBroker: false,
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

  await buyNftsFromPool(
    t,
    client,
    pool,
    nfts,
    poolOwner,
    nftOwner,
    PoolType.NFT,
    [nftUpdateAuthority.address]
  );

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
    useMakerBroker: false,
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

  await buyNftsFromPool(
    t,
    client,
    pool,
    nfts,
    poolOwner,
    buyer,
    PoolType.Trade,
    [nftUpdateAuthority.address]
  );

  // Verify final pool state
  const finalPoolAccount = await fetchPool(client.rpc, pool);
  t.is(finalPoolAccount.data.stats.takerBuyCount, 30);
});

test('getAmountOfBids returns a max of 1000 bids for "indefinite" amounts', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 1_000_000_000n,
    delta: 95_00n, // 95% delta, converges to 0 very quickly
    mmCompoundFees: false,
    mmFeeBps: 4_58,
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
  const poolAccount = await fetchPool(client.rpc, pool);
  const amountOfBids = getAmountOfBids({
    pool: poolAccount.data,
    availableLamports: 800n * ONE_SOL,
  });
  t.true(amountOfBids === 1000);
});

test('getAmountOfBids returns correct values for exponential pools', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Exponential,
    startingPrice: 1_000_000_000n,
    delta: 1_00n,
    mmCompoundFees: false,
    mmFeeBps: 4_58,
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
  const depositAmount = 15n * ONE_SOL;
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
  const poolAccount = await fetchPool(client.rpc, pool);
  const amountOfBids = getAmountOfBids({
    pool: poolAccount.data,
    availableLamports: 15n * ONE_SOL,
  });
  t.true(amountOfBids === 16);
});

test('getAmountOfBids returns correct values for linear pools', async (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000_000n,
    delta: 12_000_001n, //
    mmCompoundFees: false,
    mmFeeBps: null,
  };
  const { client, pool, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    fundPool: false,
    signerFunds: 1000n * ONE_SOL,
    poolConfig: config,
  });

  const { poolOwner } = signers;

  const depositAmount = 20n * ONE_SOL;
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
  const poolAccount = await fetchPool(client.rpc, pool);
  const amountOfBids = getAmountOfBids({
    pool: poolAccount.data,
    availableLamports: 20n * ONE_SOL,
  });

  // 23 => 19687999724 https://www.wolframalpha.com/input?i=sum+1000000000-i*12000001%2C+i%3D1%2C+i%3D23
  // 24 => 20399999700 https://www.wolframalpha.com/input?i=sum+1000000000-i*12000001%2C+i%3D1%2C+i%3D24g
  t.true(amountOfBids === 23);
});

test('calculateAmountForQuantity returns correct values for exponential pools for sell side', (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Exponential,
    startingPrice: 1_000_000_000n,
    delta: 1_00n,
    mmCompoundFees: false,
    mmFeeBps: null,
  };
  const lamportsNeeded = calculateAmountForQuantity({
    pool: { config, priceOffset: 0 },
    quantity: 2,
    side: TakerSide.Sell,
  });
  const expectedLamports = 1_000_000_000 + Math.floor(1_000_000_000 / 1.01);
  t.true(lamportsNeeded === expectedLamports);
});

test('calculateAmountForQuantity returns correct values for linear pools for sell side', (t) => {
  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000_000n,
    delta: 1_00n,
    mmCompoundFees: false,
    mmFeeBps: null,
  };
  const lamportsNeeded = calculateAmountForQuantity({
    pool: { config, priceOffset: 0 },
    quantity: 5,
    side: TakerSide.Sell,
  });
  const expectedLamports = Number(
    5n * config.startingPrice - (4n * 5n * config.delta) / 2n
  );
  t.true(lamportsNeeded === expectedLamports);
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
        owner: poolOwner.address,
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
  poolType: PoolType,
  creators: Address[]
) {
  for (const nft of nfts) {
    const poolOwnerBefore = await client.rpc
      .getBalance(poolOwner.address)
      .send();
    const buyerBefore = await client.rpc.getBalance(buyer.address).send();
    const poolAccountBefore = await fetchPool(client.rpc, pool);
    const currentTakerPrice = getCurrentAskPrice({
      pool: poolAccountBefore.data,
      royaltyFeeBps: 0,
      extraOffset: 0,
    });
    const currentMakerPrice = getCurrentAskPrice({
      pool: poolAccountBefore.data,
      royaltyFeeBps: 0,
      extraOffset: 0,
      excludeMMFee: true,
    });
    if (currentTakerPrice === null || currentMakerPrice === null) {
      t.fail('Current price is null');
    }

    const buyNftIx = await getBuyNftInstructionAsync({
      owner: poolOwner.address,
      taker: buyer,
      pool,
      mint: nft.mint,
      maxAmount: BigInt(currentTakerPrice),
      creators,
    });

    await pipe(
      await createDefaultTransaction(client, buyer),
      (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
      (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
    const poolOwnerAfter = await client.rpc
      .getBalance(poolOwner.address)
      .send();
    const buyerAfter = await client.rpc.getBalance(buyer.address).send();
    const poolAccountAfter = await fetchPool(client.rpc, pool);
    const poolOwnerDiff = poolOwnerAfter.value - poolOwnerBefore.value;
    const poolDiff =
      poolAccountAfter.data.amount - poolAccountBefore.data.amount;
    let buyerDiff = (buyerAfter.value - buyerBefore.value) * -1n;
    buyerDiff -= 5000n; // base transaction fees (5k lamports)
    buyerDiff -= BigInt(Math.floor((2 * currentMakerPrice) / 100)); // taker fees
    t.assert(buyerDiff === BigInt(currentTakerPrice));
    if (poolType === PoolType.Trade)
      t.assert(poolDiff === BigInt(currentMakerPrice));
    if (poolType === PoolType.NFT)
      t.assert(poolOwnerDiff === BigInt(currentMakerPrice) + 1398960n); // 1398960n === account rent back
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
    const calculatedTakerPrice = await getCurrentBidPrice({
      rpc: client.rpc,
      pool: poolAccountBefore.data,
      royaltyFeeBps: 0,
      extraOffset: 0,
    });
    const calculatedMakerPrice = await getCurrentBidPrice({
      rpc: client.rpc,
      pool: poolAccountBefore.data,
      royaltyFeeBps: 0,
      extraOffset: 0,
      excludeMMFee: true,
    });

    if (calculatedMakerPrice === null || calculatedTakerPrice === null) {
      t.fail('Calculated price is null');
    }
    const sellNftIx =
      poolType === PoolType.Trade
        ? await getSellNftTradePoolInstructionAsync({
            owner: poolOwner.address,
            taker: nftOwner,
            pool,
            mint: nft.mint,
            minPrice: BigInt(calculatedTakerPrice),
            whitelist,
            creators,
          })
        : await getSellNftTokenPoolInstructionAsync({
            owner: poolOwner.address,
            taker: nftOwner,
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
    const poolDiff =
      (poolAccountAfter.data.amount - poolAccountBefore.data.amount) * -1n;
    let sellerDiff = sellerAfter.value - sellerBefore.value;
    sellerDiff += 5000n; // base transaction fees (5k lamports)
    sellerDiff += BigInt(Math.floor((2 * calculatedMakerPrice) / 100)); // taker fees
    if (poolType === PoolType.Trade) sellerDiff += 1398960n; // account rent needed for trade pools
    // Taker price is what seller received (without accounting for base tx fees, taker fees and account rent)
    t.assert(BigInt(calculatedTakerPrice) === sellerDiff);
    // Maker price is exactly what pool paid for
    t.assert(BigInt(calculatedMakerPrice) === poolDiff);
  }
}
