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
  createDefaultTransaction,
  createT22NftWithRoyalties,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
  TSWAP_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { intoAddress, Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  fetchMaybePool,
  fetchPool,
  getEditPoolInstruction,
  getSellNftTokenPoolT22InstructionAsync,
  getSellNftTradePoolT22InstructionAsync,
  isSol,
  Pool,
  PoolType,
  TENSOR_AMM_ERROR__BAD_MINT_PROOF,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
  TENSOR_AMM_ERROR__WRONG_WHITELIST,
} from '../../src';
import {
  assertNftReceiptCreated,
  assertTammNoop,
  assertTokenNftOwnedBy,
  BASIS_POINTS,
  createWhitelistV2,
  errorLogsContain,
  expectCustomError,
  findAtaPda,
  getTokenAmount,
  getTokenOwner,
  TAKER_FEE_BPS,
  TestAction,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
  VIPER_ERROR__INTEGER_OVERFLOW,
} from '../_common';
import { generateTreeOfSize } from '../_merkle';
import { setupT22Test } from './_common';

test('it can sell a T22 NFT into a Trade pool', async (t) => {
  const {
    client,
    signers,
    nft,
    testConfig,
    whitelist,
    pool,
    feeVault,
    mintProof,
  } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const {
    poolConfig,
    depositAmount,
    price: minPrice,
    sellerFeeBasisPoints,
  } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = BigInt(
    (await client.rpc.getBalance(nftUpdateAuthority.address).send()).value
  );

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: pool,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });

  // Deposit Receipt should be created
  await assertNftReceiptCreated({ t, client, mint, pool });

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 0,
        takerSellCount: 1,
      },
    },
  });

  // This is a Trade pool without a shared escrow, so funds come from the pool.

  // Because this is a trade pool sell, our starting price is shifted down one delta.
  const price = poolConfig.startingPrice - poolConfig.delta;

  // Fee vault balance increases by half the taker fee, since we also pay maker and taker broker.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance + (price * (TAKER_FEE_BPS / 2n)) / BASIS_POINTS
  );

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = price;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = BigInt(
    (await client.rpc.getBalance(nftUpdateAuthority.address).send()).value
  );
  const expectedEndingUpdateAuthorityBalance =
    startingUpdateAuthorityBalance +
    (price * sellerFeeBasisPoints) / BASIS_POINTS;

  t.assert(
    endingUpdateAuthorityBalance === expectedEndingUpdateAuthorityBalance
  );
});

test('it can sell an NFT into a Trade pool w/ an escrow account', async (t) => {
  const {
    client,
    signers,
    nft,
    testConfig,
    whitelist,
    pool,
    mintProof,
    sharedEscrow,
  } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useSharedEscrow: true,
    useMakerBroker: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const { poolConfig, price: minPrice } = testConfig;

  const { mint, extraAccountMetas } = nft;

  // Starting balance of the shared escrow.
  const preSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow!).send()
  ).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    mintProof,
    sharedEscrow,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: pool,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
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

test('it can sell a T22 NFT into a Token pool', async (t) => {
  const {
    client,
    signers,
    nft,
    testConfig,
    whitelist,
    pool,
    feeVault,
    mintProof,
  } = await setupT22Test({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: true,
  });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const {
    poolConfig,
    depositAmount,
    price: minPrice,
    sellerFeeBasisPoints,
  } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  const [poolOwnerAta] = await findAtaPda({
    mint,
    owner: poolOwner.address,
    tokenProgramId: TOKEN22_PROGRAM_ID,
  });

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  const poolOwnerAtaAccount = (
    await client.rpc.getAccountInfo(poolOwnerAta, { encoding: 'base64' }).send()
  ).value;

  const poolOwnerAtaData = poolOwnerAtaAccount!.data;

  const tokenAmount = getTokenAmount(poolOwnerAtaData);
  const tokenOwner = getTokenOwner(poolOwnerAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === poolOwner.address);

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 0,
        takerSellCount: 1,
      },
    },
  });

  // This is a Token pool without a shared escrow, so funds come from the pool.
  // Token pools do not get the mmFee.
  t.assert(postPoolBalance === prePoolBalance - poolConfig.startingPrice);

  // Fee vault balance increases by half the taker fee, since we also pay maker and taker broker.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance >=
      startingFeeVaultBalance +
        (poolConfig.startingPrice * (TAKER_FEE_BPS / 2n)) / BASIS_POINTS
  );

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = poolConfig.startingPrice;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (poolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});

test('token pool autocloses when currency amount drops below current price', async (t) => {
  // We need a deposit amount that will be less than the current price after one sell.
  const depositAmount = (tokenPoolConfig.startingPrice * 3n) / 2n; // 1.5x the starting price

  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      depositAmount,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const { poolConfig, price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  const startingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  // The amount left in the pool should be less than the current price
  //  so the pool should be auto-closed.
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

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;

  const { price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  assertTammNoop(t, client, sig);
});

test('sellNftTradePool emits self-cpi logging event', async (t) => {
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const { price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  assertTammNoop(t, client, sig);
});

test('it can sell an NFT into a trade pool w/ set cosigner', async (t) => {
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: true,
      useCosigner: true,
    });

  const {
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    cosigner,
    makerBroker,
    takerBroker,
  } = signers;

  const { price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    cosigner,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: pool,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
  });
});

test('it cannot sell an NFT into a token pool w/ incorrect cosigner', async (t) => {
  const fakeCosigner = await generateKeyPairSigner();

  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useCosigner: true,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const { price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Sell NFT into pool without specifying cosigner
  const sellNftIxNoCosigner = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    // no cosigner passed in
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  // Sell NFT into pool with fakeCosigner
  const sellNftIxIncorrectCosigner =
    await getSellNftTokenPoolT22InstructionAsync({
      owner: poolOwner.address, // pool owner
      taker: nftOwner, // nft owner--the seller
      takerTa: ownerAta,
      pool,
      whitelist,
      mint,
      mintProof,
      cosigner: fakeCosigner, // Invalid cosigner!
      makerBroker: makerBroker.address,
      takerBroker: takerBroker.address,
      minPrice,
      escrowProgram: TSWAP_PROGRAM_ID,
      tokenProgram: TOKEN22_PROGRAM_ID,
      // Remaining accounts
      creators: [nftUpdateAuthority.address],
      transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

test('it cannot sell an NFT into a trade pool w/ incorrect cosigner', async (t) => {
  const fakeCosigner = await generateKeyPairSigner();

  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useCosigner: true,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;

  const { price: minPrice } = testConfig;

  const { mint, ownerAta, extraAccountMetas } = nft;

  // Sell NFT into pool without specifying cosigner
  const sellNftIxNoCosigner = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    takerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    // no cosigner passed in
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  // Sell NFT into pool with fakeCosigner
  const sellNftIxIncorrectCosigner =
    await getSellNftTradePoolT22InstructionAsync({
      owner: poolOwner.address, // pool owner
      taker: nftOwner, // nft owner--the seller
      takerTa: ownerAta,
      pool,
      whitelist,
      mint,
      mintProof,
      cosigner: fakeCosigner, // Invalid cosigner!
      makerBroker: makerBroker.address,
      takerBroker: takerBroker.address,
      minPrice,
      tokenProgram: TOKEN22_PROGRAM_ID,
      // Remaining accounts
      creators: [nftUpdateAuthority.address],
      transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: false,
    });

  const { payer, poolOwner, nftOwner, nftUpdateAuthority } = signers;

  const { price: minPrice } = testConfig;

  // The NFT that is legitimately in the whitelist for the pool.
  const { mint, extraAccountMetas } = nft;

  // We setup a NFT that is a valid member of some other whitelist and then try to sell
  // it into our pool.

  // Mint NFT
  const sellerFeeBasisPoints = 500n;
  const { mint: otherMint } = await createT22NftWithRoyalties({
    client,
    payer,
    owner: nftOwner.address, // Same owner as the NFT that is legitimately in the whitelist
    mintAuthority: nftUpdateAuthority, // Same authority as legitimate NFT
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
    royalties: {
      key: '_ro_' + nftUpdateAuthority.address,
      value: sellerFeeBasisPoints.toString(),
    },
  });

  // Other Whitelist Authority
  const otherWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  // Setup a merkle tree with our mint as a leaf
  const {
    root: otherRoot,
    proofs: [p],
  } = await generateTreeOfSize(10, [otherMint]);

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: otherWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: otherWhitelistAuthority,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(otherRoot) }],
  });

  // Create the mint proof for the whitelist.
  const { mintProof: otherMintProof } = await upsertMintProof({
    client,
    payer: nftOwner,
    mint: otherMint,
    whitelist: otherWhitelist,
    proof: p.proof,
  });

  // We now have a T22 NFT that is a valid member of our OtherWhitelist,
  // but that is the wrong whitelist for our pool.

  // Try to sell the NFT in the other whitelist into the pool using the other whitelist
  const sellNftIxMintWL = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint: otherMint, // This mint is in the other whitelist!
    whitelist: otherWhitelist, // This whitelist is not the pool's whitelist!
    mintProof: otherMintProof, // Proves NFT is part of the Other Whitelist
    minPrice,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [otherWhitelistAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);

  // Try to sell the NFT into the pool specifying pool's whitelist
  let ix = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist, // Correct whitelist!
    mint: otherMint, // This mint is not in the pool's whitelist!
    mintProof: otherMintProof, // Proves NFT is part of the Other Whitelist
    tokenProgram: TOKEN22_PROGRAM_ID,
    minPrice: minPrice,
    creators: [otherWhitelistAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  // Mint proof will not match whitelist
  let promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  // Error is thrown in a whitelist utility function so throws
  // a whitelist error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__BAD_MINT_PROOF);

  // Specify the correct whitelist, and a valid mint proof for that whitelist
  // but the mint still isn't in the whitelist.
  ix = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist, // Correct whitelist!
    mintProof, // Proves `mint` is part of the pool's whitelist, but not otherMint
    mint: otherMint, // This mint is not in the pool's whitelist and doesn't match mint proof
    tokenProgram: TOKEN22_PROGRAM_ID,
    minPrice: minPrice,
    creators: [otherWhitelistAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  // Mint proof will not match whitelist
  promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__BAD_MINT_PROOF);

  // Finally, use the correct mint, with the correct mint proof, with the correct whitelist.
  ix = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist, // Correct whitelist!
    mintProof, // Correct mint proof!
    mint, // Correct mint!
    tokenProgram: TOKEN22_PROGRAM_ID,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address], // Correct creator for the NFT
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
});

test('selling into a Trade pool fails when the wrong creator is passed in as a remaining account', async (t) => {
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, makerBroker, takerBroker } = signers;

  const { price: minPrice } = testConfig;

  const { mint, extraAccountMetas } = nft;

  const fakeCreator = await generateKeyPairSignerWithSol(client);

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [fakeCreator.address], // Fake creator!
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Instruction is expecting a creator account which is not passed in
  // so: "insufficient account keys".
  await errorLogsContain(
    t,
    promise,
    'insufficient account keys for instruction'
  );
});

test('selling into a Token pool fails when the wrong creator is passed in as a remaining account', async (t) => {
  const { client, signers, nft, testConfig, whitelist, pool, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useMakerBroker: true,
    });

  const { poolOwner, nftOwner, makerBroker, takerBroker } = signers;

  const { price: minPrice } = testConfig;

  const { mint, extraAccountMetas } = nft;

  const fakeCreator = await generateKeyPairSignerWithSol(client);

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [fakeCreator.address], // Fake creator!
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Instruction is expecting a creator account which is not passed in
  // so: "insufficient account keys".
  await errorLogsContain(
    t,
    promise,
    'insufficient account keys for instruction'
  );
});

test('pool owner cannot perform a sandwich attack on a seller on a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: false,
      fundPool: true,
    });

  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint, extraAccountMetas } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint,
    mintProof,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  // Pool owner edits the pool to update the mmFee to the maximum value.
  let newConfig = { ...tradePoolConfig, mmFeeBps: 9999 };

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

  // Should fail with an integer overflow error.
  await expectCustomError(t, promise, VIPER_ERROR__INTEGER_OVERFLOW);

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

test('trade pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupT22Test({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: true, // MakerBroker is set
      fundPool: true,
    });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint, extraAccountMetas } = nft;

  let sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    mintProof,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    mintProof,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('token pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupT22Test({
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
  const { mint, extraAccountMetas } = nft;

  let sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    mintProof,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    mintProof,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});
