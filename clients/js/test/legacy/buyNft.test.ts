import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  generateKeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  Creator,
  TokenStandard,
  createDefaultNft,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  Pool,
  PoolType,
  TENSOR_AMM_ERROR__BAD_COSIGNER,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftInstructionAsync,
  getDepositNftInstructionAsync,
  isSol,
} from '../../src/index.js';
import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  BASIS_POINTS,
  TestAction,
  assertNftReceiptClosed,
  assertTammNoop,
  assertTokenNftOwnedBy,
  createPool,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  nftPoolConfig,
  setupLegacyTest,
  tradePoolConfig,
} from '../_common.js';

test('it can buy an NFT from a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
  });

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 1,
        takerSellCount: 0,
        //accumulatedMmProfit: ?
      },
    },
  });

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Deposit Receipt is closed
  await assertNftReceiptClosed({ t, client, pool, mint });
});

test('buying NFT from a trade pool increases currency amount', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useSharedEscrow: false,
    compoundFees: true,
    fundPool: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { poolConfig, price: maxAmount } = testConfig;
  const { mint } = nft;

  // Balance of pool before any sales operations.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const poolAccount = await fetchPool(client.rpc, pool);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
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

test('buyNft emits a self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useSharedEscrow: false,
    compoundFees: true,
    fundPool: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
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

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
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

  // Mint NFTs
  const { mint: mint1 } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  const { mint: mint2 } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  const [poolAta1] = await findAtaPda({ mint: mint1, owner: pool });

  // Deposit NFTs
  const depositNftIx1 = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint: mint1,
  });

  const depositNftIx2 = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint: mint2,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx1, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIx2, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFTs are now owned by the pool.
  const poolAtaAccount1 = await client.rpc
    .getAccountInfo(poolAta1, { encoding: 'base64' })
    .send();

  const poolAtaData1 = poolAtaAccount1!.value!.data;

  const tokenAmount1 = getTokenAmount(poolAtaData1);
  const tokenOwner1 = getTokenOwner(poolAtaData1);

  t.assert(tokenAmount1 === 1n);
  t.assert(tokenOwner1 === pool);

  const poolAtaAccount2 = await client.rpc
    .getAccountInfo(poolAta1, { encoding: 'base64' })
    .send();

  const poolAtaData2 = poolAtaAccount2!.value!.data;

  const tokenAmount2 = getTokenAmount(poolAtaData2);
  const tokenOwner2 = getTokenOwner(poolAtaData2);

  t.assert(tokenAmount2 === 1n);
  t.assert(tokenOwner2 === pool);

  await getAndFundFeeVault(client, pool);

  // Buy the first NFT from pool
  const buyNftIx1 = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    rentPayer: rentPayer.address,
    pool,
    mint: mint1,
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
  const buyNftIx2 = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    rentPayer: rentPayer.address,
    pool,
    mint: mint2,
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
  const { client, signers, nft, testConfig, pool, sharedEscrow } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: true,
      compoundFees: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { poolConfig, price: maxAmount } = testConfig;
  const { mint } = nft;

  const startingEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useCosigner: true,
    fundPool: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority, cosigner } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
  });
});

test('it cannot buy an NFT from a pool w/ incorrect cosigner', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useCosigner: true,
    fundPool: false,
  });

  const fakeCosigner = await generateKeyPairSigner();

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool without specififying cosigner
  const buyNftIxNoCosigner = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    creators: [nftUpdateAuthority.address],
  });

  const promiseNoCosigner = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxNoCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseNoCosigner, TENSOR_AMM_ERROR__BAD_COSIGNER);

  // Buy NFT from pool with fakeCosigner
  const buyNftIxIncorrectCosigner = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
    TENSOR_AMM_ERROR__BAD_COSIGNER
  );
});

test('it can buy a pNFT and pay the correct amount of royalties', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);
  // Creator of the NFT.
  const creatorKeypair = await generateKeyPairSignerWithSol(client);
  const creator = {
    address: creatorKeypair.address,
    verified: true,
    share: 100,
  } as Creator;

  const config = tradePoolConfig;

  // Create whitelist with FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: creatorKeypair,
    conditions: [{ mode: Mode.FVC, value: creator.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  // 1.1x the starting price.
  const maxAmount = (config.startingPrice * 100n) / 10n + config.startingPrice;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  const { mint, metadata } = await createDefaultNft({
    client,
    payer: owner,
    authority: creatorKeypair,
    owner: owner,
    standard: TokenStandard.ProgrammableNonFungible,
    creators: [creator],
  });

  const { sellerFeeBasisPoints } = (await fetchMetadata(client.rpc, metadata))
    .data;

  // Use higher CU limit, pNFTs expensive
  const cuLimitIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    // Remaining accounts
    creators: [creator.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
  });

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Creator receives exactly the sellerFeeBasisPoints specified in pNFTs metadata of the buy price
  // postBalance === preBalance + currentPrice * sellerFeeBasisPoints / 100_00
  const endingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  t.assert(
    endingCreatorBalance ===
      startingCreatorBalance +
        (BigInt(sellerFeeBasisPoints) * config.startingPrice) / 100_00n
  );
});

test('it cannot buy an NFT from a trade pool w/ incorrect deposit receipt', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
  });

  // Create pool
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  // Mint another NFT
  const { mint: mintNotInPool } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  // Deposit NFT
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

  // NFT is now owned by the pool.
  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // Buy NFT from pool with incorrect deposit receipt (not deposited mint)
  const [incorrectNftReceipt] = await findNftDepositReceiptPda({
    pool,
    mint: mintNotInPool,
  });
  const buyNftIxNotDepositedNft = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
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
  const depositNftIxIntoOtherPool = await getDepositNftInstructionAsync({
    owner,
    pool: otherPool,
    whitelist,
    mint: mintNotInPool,
  });
  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIxIntoOtherPool, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [incorrectNftReceiptOtherPool] = await findNftDepositReceiptPda({
    pool: otherPool,
    mint: mintNotInPool,
  });
  const buyNftIxWrongPoolNftReceipt = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
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
