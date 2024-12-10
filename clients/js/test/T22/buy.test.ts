import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  pipe,
} from '@solana/web3.js';
import { findAssociatedTokenAccountPda } from '@tensor-foundation/resolvers';
import {
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22NftWithRoyalties,
  generateKeyPairSignerWithSol,
  getBalance,
  LAMPORTS_PER_SOL,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { intoAddress, Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftT22InstructionAsync,
  getCurrentAskPrice,
  getDepositNftT22InstructionAsync,
  getEditPoolInstruction,
  isSol,
  Pool,
  PoolType,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
} from '../../src';
import {
  assertNftReceiptClosed,
  assertTammNoop,
  assertTokenNftOwnedBy,
  BASIS_POINTS,
  COMPUTE_500K_IX,
  createPool,
  createPoolAndWhitelist,
  createProofWhitelist,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  MAX_MM_FEES_BPS,
  nftPoolConfig,
  TAKER_FEE_BPS,
  TestAction,
  tradePoolConfig,
  upsertMintProof,
} from '../_common';
import { generateTreeOfSize } from '../_merkle';
import { setupT22Test, testBuyNft } from './_common';

test('buy from NFT pool', async (t) => {
  const legacyTest = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, legacyTest, {
    brokerPayments: false,
  });
});

test('buy from NFT pool, wrong owner fails', async (t) => {
  const t22Test = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const wrongOwner = await generateKeyPairSigner();
  t22Test.signers.poolOwner = wrongOwner;

  // The seeds derivation will fail.
  await testBuyNft(t, t22Test, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('buy from Trade pool, wrong owner fails', async (t) => {
  const t22Test = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const wrongOwner = await generateKeyPairSigner();
  t22Test.signers.poolOwner = wrongOwner;

  // The seeds derivation will fail.
  await testBuyNft(t, t22Test, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('buy from NFT pool, pay brokers', async (t) => {
  const legacyTest = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: true,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, legacyTest, {
    brokerPayments: true,
  });
});

test('buy from NFT pool, skip non-rent-exempt creator', async (t) => {
  const client = createDefaultSolanaClient();
  const creator = (await generateKeyPairSigner()).address;

  // Set starting price low enough that the royalties don't push it above the rent exempt threshold.
  const config = nftPoolConfig;
  config.startingPrice = 10000n;
  config.delta = config.startingPrice / 10n;

  const t22Test = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    poolConfig: config,
    creator: {
      address: creator,
      share: 100,
      verified: true,
    },
  });

  await testBuyNft(t, t22Test, {
    brokerPayments: false,
    checkCreatorBalances: false,
    creator,
  });

  // Creator should have a balance of 0
  const balance = await getBalance(client, creator);
  t.assert(balance === 0n);
});

test('buy from NFT pool, max price higher than current price succeeds', async (t) => {
  t.timeout(15_000);
  for (const adjust of [101n, 10000n]) {
    const legacyTest = await setupT22Test({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the pre-configured maxPrice which includes the royalties.
    legacyTest.testConfig.price = (legacyTest.testConfig.price * adjust) / 100n;

    await testBuyNft(t, legacyTest, {
      brokerPayments: false,
    });
  }
});

test('buy from NFT pool, max price lower than current price fails', async (t) => {
  t.timeout(15_000);
  for (const adjust of [99n, 50n]) {
    const t22Test = await setupT22Test({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the starting price which does not have royalties added, so we can test the price mismatch logic.
    t22Test.testConfig.price =
      (t22Test.testConfig.poolConfig.startingPrice * adjust) / 100n;

    await testBuyNft(t, t22Test, {
      brokerPayments: false,
      expectError: TENSOR_AMM_ERROR__PRICE_MISMATCH,
    });
  }
});

test('it can buy a T22 NFT from a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount, sellerFeeBasisPoints } = testConfig;

  const { mint, extraAccountMetas } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
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

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance +
        (tradePoolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint, pool });

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (tradePoolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});

test('buying NFT from a trade pool increases currency amount', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      compoundFees: true,
      fundPool: false,
      useMakerBroker: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { poolConfig, price: maxAmount, sellerFeeBasisPoints } = testConfig;

  const { mint, extraAccountMetas } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  const startingPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
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

  const endingPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance +
        (tradePoolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint, pool });

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (tradePoolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );

  // This is a Trade pool with mm compound fees so funds go to the pool instead of straight through to the pool's owner.
  // The pool's post balance should be the pre-balance plus the price paid for the NFT plus the mm fee.
  const mmFee =
    (poolConfig.startingPrice * BigInt(poolConfig.mmFeeBps ?? 0)) /
    BASIS_POINTS;

  const lamportsAdded = poolConfig.startingPrice + mmFee;

  t.assert(endingPoolBalance === startingPoolBalance + lamportsAdded);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one buy so the pool currency amount should just be the new lamports added.
  t.assert(updatedPoolAccount.data.amount === lamportsAdded);
});

test('it can buy a T22 NFT from a Trade pool w/ a shared escrow', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault, sharedEscrow } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: true,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { poolConfig, price: maxAmount, sellerFeeBasisPoints } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Starting balance of the shared escrow.
  const startingEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    sharedEscrow,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
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

  // Shared Escrow balance increases exactly by the pool's startingPrice.
  const endingEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;
  t.assert(
    startingEscrowBalance === endingEscrowBalance - poolConfig.startingPrice
  );

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance +
        (tradePoolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint, pool });

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (tradePoolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});

test('buy from wrong NFT pool fails', async (t) => {
  t.timeout(15_000);
  const client = createDefaultSolanaClient();
  const payer = await generateKeyPairSignerWithSol(client);
  const traderA = await generateKeyPairSignerWithSol(client);
  const traderB = await generateKeyPairSignerWithSol(client);

  // Mint NFT
  const { mint: mintA, extraAccountMetas: extraAccountMetasA } =
    await createT22NftWithRoyalties({
      client,
      payer,
      owner: traderA.address,
      mintAuthority: traderA,
      freezeAuthority: null,
      decimals: 0,
      data: {
        name: 'Test Token',
        symbol: 'TT',
        uri: 'https://example.com',
      },
      royalties: {
        key: '_ro_' + traderA.address,
        value: 500n.toString(),
      },
    });
  // Mint NFT
  const { mint: mintB, extraAccountMetas: extraAccountMetasB } =
    await createT22NftWithRoyalties({
      client,
      payer,
      owner: traderB.address,
      mintAuthority: traderB,
      freezeAuthority: null,
      decimals: 0,
      data: {
        name: 'Test Token',
        symbol: 'TT',
        uri: 'https://example.com',
      },
      royalties: {
        key: '_ro_' + traderB.address,
        value: 500n.toString(),
      },
    });
  const { whitelist, proofs } = await createProofWhitelist(
    client,
    traderA,
    [mintA, mintB],
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
    mint: mintA,
    whitelist,
    proof: proofs[0].proof,
  });

  const { mintProof: mintProofB } = await upsertMintProof({
    client,
    payer,
    mint: mintB,
    whitelist,
    proof: proofs[1].proof,
  });

  // Deposit NFTs into resepective pools
  const depositNftIxA = await getDepositNftT22InstructionAsync({
    pool: poolA,
    mint: mintA,
    owner: traderA,
    whitelist,
    mintProof: mintProofA,
    transferHookAccounts: extraAccountMetasA.map((m) => m.address),
  });
  const depositNftIxB = await getDepositNftT22InstructionAsync({
    pool: poolB,
    mint: mintB,
    owner: traderB,
    whitelist,
    mintProof: mintProofB,
    transferHookAccounts: extraAccountMetasB.map((m) => m.address),
  });

  await pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(depositNftIxA, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIxB, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Try to buy NFT B from pool A, the default derived NFT receipt will be from
  // pool A and NFT B which won't exist so the error is account unintialized.
  let buyNftIx = await getBuyNftT22InstructionAsync({
    rentPayer: payer.address,
    owner: traderA.address,
    pool: poolA,
    taker: traderB,
    mint: mintB,
    maxAmount: 1n,
    creators: [traderA.address],
    transferHookAccounts: extraAccountMetasB.map((m) => m.address),
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
    mint: mintA,
    pool: poolA,
  });

  // Derive pool token account
  const [poolTokenAccount] = await findAssociatedTokenAccountPda({
    mint: mintA,
    owner: poolA,
    tokenProgram: TOKEN22_PROGRAM_ID,
  });

  buyNftIx = await getBuyNftT22InstructionAsync({
    rentPayer: payer.address,
    owner: traderA.address,
    pool: poolA,
    taker: traderB,
    mint: mintB,
    maxAmount: 1n,
    nftReceipt: nftReceiptA,
    poolTa: poolTokenAccount,
    creators: [traderA.address],
    transferHookAccounts: extraAccountMetasB.map((m) => m.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, traderB),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);

  // Try to buy NFT A from pool B, the default derived NFT receipt will be from
  // pool B and NFT A which won't exist so the error is account uninitialized.
  buyNftIx = await getBuyNftT22InstructionAsync({
    rentPayer: payer.address,
    owner: traderB.address,
    pool: poolB,
    taker: traderA,
    mint: mintA,
    maxAmount: 1n,
    creators: [traderA.address],
    transferHookAccounts: extraAccountMetasA.map((m) => m.address),
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
    mint: mintB,
    pool: poolB,
  });

  // Derive pool token account
  const [poolTokenAccountB] = await findAssociatedTokenAccountPda({
    mint: mintB,
    owner: poolB,
    tokenProgram: TOKEN22_PROGRAM_ID,
  });

  buyNftIx = await getBuyNftT22InstructionAsync({
    rentPayer: payer.address,
    owner: traderB.address,
    pool: poolB,
    taker: traderA,
    mint: mintA,
    maxAmount: 1n,
    nftReceipt: nftReceiptB,
    poolTa: poolTokenAccountB,
    creators: [traderA.address],
    transferHookAccounts: extraAccountMetasA.map((m) => m.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('buy from Trade pool', async (t) => {
  const t22Test = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, t22Test, {
    brokerPayments: false,
  });
});

test('buy from Trade pool, pay brokers', async (t) => {
  const t22Test = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: true,
    useSharedEscrow: false,
    fundPool: false,
  });

  await testBuyNft(t, t22Test, {
    brokerPayments: true,
  });
});

test('buy from Trade pool, max price higher than current price succeeds', async (t) => {
  t.timeout(15_000);
  for (const adjust of [101n, 10000n]) {
    const t22Test = await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the pre-configured maxPrice which includes the mm fee and royalties.
    t22Test.testConfig.price = (t22Test.testConfig.price * adjust) / 100n;

    await testBuyNft(t, t22Test, {
      brokerPayments: false,
    });
  }
});

test('buy from Trade pool, max price lower than current price fails', async (t) => {
  t.timeout(15_000);
  for (const adjust of [99n, 50n]) {
    const t22Test = await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: false,
    });

    // We multiply by the starting price which does not have mm fee androyalties added, so we can test the price mismatch logic.
    t22Test.testConfig.price =
      (t22Test.testConfig.poolConfig.startingPrice * adjust) / 100n;

    await testBuyNft(t, t22Test, {
      brokerPayments: false,
      expectError: TENSOR_AMM_ERROR__PRICE_MISMATCH,
    });
  }
});

test('buy from Token pool fails', async (t) => {
  // Setup a Token pool, funded with SOL.
  const t22Test = await setupT22Test({
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
  await testBuyNft(t, t22Test, {
    brokerPayments: false,
    expectError: ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  });
});

test('it can buy a T22 NFT from a NFT pool and auto-close the pool', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupT22Test({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      fundPool: false,
    });

  const expectedFeeVault = await getAndFundFeeVault(client, pool);
  t.is(feeVault, expectedFeeVault);

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount, sellerFeeBasisPoints } = testConfig;

  const { mint, extraAccountMetas } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });

  // Pool is closed because no more NFTs are available.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance +
        (testConfig.poolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint, pool });

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (testConfig.poolConfig.startingPrice * sellerFeeBasisPoints) /
          BASIS_POINTS
  );
});

test('buyNft on a trade pool emits a self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('buyNft on a NFT pool emits a self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    useMakerBroker: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('it can buy an NFT from a pool w/ a set cosigner', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useCosigner: true,
    useMakerBroker: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority, cosigner } = signers;

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    cosigner,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });
});

test('it cannot buy an NFT from a pool w/ incorrect or no cosigner', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useCosigner: true,
    useMakerBroker: true,
  });

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker } = signers;

  const fakeCosigner = await generateKeyPairSigner();

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas } = nft;

  let ix = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    cosigner: fakeCosigner, // Incorrect!
    tokenProgram: TOKEN22_PROGRAM_ID,
    makerBroker: makerBroker.address,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_COSIGNER);

  ix = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    // No cosigner
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('it cannot buy an NFT from a trade pool w/ incorrect deposit receipt', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useMakerBroker: true,
  });

  const {
    payer,
    buyer,
    poolOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = signers;

  const { poolConfig, price: maxAmount } = testConfig;

  // This mint is the NFT deposited into the pool.
  const { mint, extraAccountMetas } = nft;

  // Mint another NFT--same owner and authority, but not deposited into pool.
  const { mint: otherMint, extraAccountMetas: otherExtraAccountMetas } =
    await createT22NftWithRoyalties({
      client,
      payer,
      owner: poolOwner.address,
      mintAuthority: nftUpdateAuthority,
      freezeAuthority: null,
      decimals: 0,
      data: {
        name: 'Test Token',
        symbol: 'TT',
        uri: 'https://example.com',
      },
      royalties: {
        key: '_ro_' + nftUpdateAuthority.address,
        value: 500n.toString(),
      },
    });

  // Buy NFT from pool with incorrect deposit receipt (not deposited mint)
  const [incorrectNftReceipt] = await findNftDepositReceiptPda({
    pool,
    mint: otherMint,
  });

  let ix = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    nftReceipt: incorrectNftReceipt,
    tokenProgram: TOKEN22_PROGRAM_ID,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [otherMint]);

  // Initialize a different pool, with the same owner.
  const { whitelist: otherWhitelist, pool: otherPool } =
    await createPoolAndWhitelist({
      client,
      payer,
      owner: poolOwner,
      config: poolConfig,
      conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
      funded: false,
    });

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer,
    mint: otherMint,
    whitelist: otherWhitelist,
    proof: p.proof,
  });

  // Deposit other NFT into it.
  const depositNftIxIntoOtherPool = await getDepositNftT22InstructionAsync({
    owner: poolOwner,
    pool: otherPool,
    whitelist: otherWhitelist,
    mint: otherMint,
    mintProof,
    tokenProgram: TOKEN22_PROGRAM_ID,
    transferHookAccounts: otherExtraAccountMetas.map((a) => a.address),
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositNftIxIntoOtherPool, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // A valid deposit receipt, but for the wrong pool.
  const [nftReceiptOtherPool] = await findNftDepositReceiptPda({
    pool: otherPool,
    mint: otherMint,
  });

  ix = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    nftReceipt: nftReceiptOtherPool,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('pool owner cannot perform a sandwich attack on the buyer on a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    useSharedEscrow: false,
    useMakerBroker: false,
    fundPool: false,
  });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { price: maxAmount } = testConfig;
  const { mint, extraAccountMetas } = nft;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount, // Exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  const { client, signers, nft, testConfig, pool } = await setupT22Test({
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
  const { mint, extraAccountMetas } = nft;

  // Buy NFT from pool
  let buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    // no maker broker passed in
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  // Buy NFT from pool
  buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    makerBroker: fakeMakerBroker.address, // incorrect makerBroker
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('buy a ton with default exponential curve + tolerance', async (t) => {
  t.timeout(150_000); // Increase timeout due to many operations

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

  // Prepare multiple NFTs
  const nfts = await Promise.all(
    Array(numBuys)
      .fill(null)
      .map(async () => {
        const { mint, extraAccountMetas } = await createT22NftWithRoyalties({
          client,
          payer: traderA,
          owner: traderA.address,
          mintAuthority: traderA,
          freezeAuthority: null,
          data: {
            name: 'Test Token',
            symbol: 'TT',
            uri: 'https://example.com',
          },
          royalties: {
            key: '_ro_' + traderA.address,
            value: '0',
          },
        });
        const [ataA] = await findAtaPda({ mint, owner: traderA.address });
        const [ataB] = await findAtaPda({ mint, owner: traderB.address });
        return { mint, ataA, ataB, extraAccountMetas };
      })
  );

  t.log('creating whitelist and pool');

  // Setup a merkle tree with our mint as a leaf
  const { root, proofs } = await generateTreeOfSize(
    numBuys,
    nfts.map((nft) => nft.mint)
  );

  // Prepare whitelist and pool
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: traderA,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
  });

  const { pool } = await createPool({
    client,
    whitelist,
    owner: traderA,
    config,
  });

  t.log('depositing nfts');

  // Deposit all NFTs
  for (const [i, nft] of nfts.entries()) {
    // Create the mint proof for the whitelist.
    const { mintProof } = await upsertMintProof({
      client,
      payer: traderA,
      mint: nft.mint,
      whitelist,
      proof: proofs[i].proof,
    });

    const depositNftIx = await getDepositNftT22InstructionAsync({
      owner: traderA,
      pool,
      whitelist,
      mint: nft.mint,
      mintProof,
      transferHookAccounts: nft.extraAccountMetas.map((a) => a.address),
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

    const buyNftIx = await getBuyNftT22InstructionAsync({
      owner: traderA.address,
      taker: traderB,
      pool,
      mint: nft.mint,
      maxAmount: currPrice ?? 0n,
      creators: [traderA.address],
      transferHookAccounts: nft.extraAccountMetas.map((a) => a.address),
    });

    await pipe(
      await createDefaultTransaction(client, traderB),
      (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
      (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  }

  t.log('verifying nft ownership');

  // Check NFTs have been transferred correctly
  for (const nft of nfts) {
    await assertTokenNftOwnedBy({
      t,
      client,
      mint: nft.mint,
      owner: traderB.address,
      tokenProgramAddress: TOKEN22_PROGRAM_ID,
    });
  }
});
