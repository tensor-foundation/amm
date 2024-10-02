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
  TENSOR_AMM_ERROR__MISSING_COSIGNER,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftInstructionAsync,
  getDepositNftInstructionAsync,
  getEditPoolInstruction,
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
  tradePoolConfig,
} from '../_common.js';
import { setupLegacyTest } from './_common.js';

test('it can buy an NFT from a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { poolConfig } = testConfig;
  const { mint } = nft;

  // Max amount is the maximum price the user is willing to pay for the NFT + creators fee and mm fee, if applicable.
  const mmFee = poolConfig.startingPrice * BigInt(poolConfig.mmFeeBps ?? 0);
  const royalties = (poolConfig.startingPrice * 500n) / 10000n;
  // It should work with exact amount, but users might also pad this to allow for slippage.
  const maxAmount = poolConfig.startingPrice + mmFee + royalties;

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
    useMakerBroker: true,
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

test('buyNft from a Trade pool emits a self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: true,
  });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    makerBroker: makerBroker.address,
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

test('buyNft from a NFT pool emits a self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: true,
  });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    makerBroker: makerBroker.address,
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
      useMakerBroker: true,
      compoundFees: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
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
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
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
    useMakerBroker: false,
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
    useMakerBroker: false,
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
  await expectCustomError(
    t,
    promiseNoCosigner,
    TENSOR_AMM_ERROR__MISSING_COSIGNER
  );

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
  const { client, signers, nft, pool, feeVault, testConfig } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      pNft: true,
    });

  const { buyer, poolOwner, nftUpdateAuthority: creator } = signers;
  const { poolConfig, price: maxAmount } = testConfig;
  const { mint, metadata } = nft;

  const { sellerFeeBasisPoints } = (await fetchMetadata(client.rpc, metadata))
    .data;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
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
    (tx) =>
      appendTransactionMessageInstruction(
        getSetComputeUnitLimitInstruction({ units: 400_000 }),
        tx
      ),
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
        (BigInt(sellerFeeBasisPoints) * poolConfig.startingPrice) / 100_00n
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

test('pool owner cannot perform a sandwich attack on the buyer on a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    pNft: true,
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
    maxAmount, // Exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  // Pool owner edits the pool to update the mmFee to the maximum value.
  let newConfig = { ...tradePoolConfig, mmFeeBps: 9999 };

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
  const { client, signers, nft, testConfig, pool } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: true, // Maker broker set on pool
    useSharedEscrow: false,
    fundPool: false,
    pNft: true,
  });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;
  const { mint } = nft;

  // Buy NFT from pool
  let buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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

  // Should fail with a wrong makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  // Buy NFT from pool
  buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
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
