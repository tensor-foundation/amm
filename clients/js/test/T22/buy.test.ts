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
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { intoAddress, Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftT22InstructionAsync,
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
  ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
  assertNftReceiptClosed,
  assertTammNoop,
  assertTokenNftOwnedBy,
  BASIS_POINTS,
  createPoolAndWhitelist,
  expectCustomError,
  TAKER_FEE_BPS,
  TestAction,
  tradePoolConfig,
  upsertMintProof,
} from '../_common';
import { generateTreeOfSize } from '../_merkle';
import { setupT22Test } from './_common';

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

test('it can buy a T22 NFT from a NFT pool and auto-close the pool', async (t) => {
  const { client, signers, nft, testConfig, pool, feeVault } =
    await setupT22Test({
      t,
      poolType: PoolType.NFT,
      action: TestAction.Buy,
      useMakerBroker: false,
      fundPool: false,
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

  // Pool is closed because no more NFTs are available.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

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

  assertTammNoop(t, client, sig);
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

  assertTammNoop(t, client, sig);
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
