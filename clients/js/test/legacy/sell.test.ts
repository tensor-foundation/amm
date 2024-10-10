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
  Creator,
  TokenStandard,
  createDefaultNft,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
import {
  TSWAP_PROGRAM_ID,
  assertTokenNftOwnedBy,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Mode,
  TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  NftDepositReceipt,
  Pool,
  PoolConfig,
  PoolType,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
  TENSOR_AMM_ERROR__WRONG_WHITELIST,
  fetchMaybePool,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getCurrentBidPrice,
  getDepositSolInstruction,
  getEditPoolInstruction,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
  isSol,
} from '../../src/index.js';
import {
  DEFAULT_DELTA,
  TestAction,
  VIPER_ERROR__INTEGER_OVERFLOW,
  assertTammNoop,
  createAndFundEscrow,
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTestSigners,
  getTokenAmount,
  getTokenOwner,
  tokenPoolConfig,
  tradePoolConfig,
} from '../_common.js';
import { setupLegacyTest } from './_common.js';

test('it can sell an NFT into a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();
  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    await getTestSigners(client);

  const config = tradePoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
    funded: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);
  t.assert(poolAccount.data.config.mmFeeBps === 50);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
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
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // Fee vault balance increases.
  const postSaleFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(postSaleFeeVaultBalance > startingFeeVaultBalance);

  // This is a Trade pool without a shared escrow, so funds come from the pool.

  // Because this is a trade pool sell our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = price;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Deposit Receipt should be created
  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });
  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    Account<NftDepositReceipt, Address>
  >{
    address: nftReceipt,
    data: {
      mint,
      pool,
    },
  });
});

test('it can sell an NFT into a Trade pool w/ an escrow account', async (t) => {
  const client = createDefaultSolanaClient();
  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    await getTestSigners(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 10n * DEFAULT_DELTA,
    delta: DEFAULT_DELTA,
    mmCompoundFees: false,
    mmFeeBps: 50,
  };

  const depositAmount = config.startingPrice * 10n;

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Create a shared escrow account.
  const sharedEscrow = await createAndFundEscrow(client, poolOwner, 1);

  // Starting balance of the shared escrow.
  const preSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow).send()
  ).value;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
    sharedEscrow,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
    funded: false, // cannot deposit to shared escrow pool
  });

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  await getAndFundFeeVault(client, pool);

  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      sharedEscrow,
      config,
    },
  });

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    sharedEscrow,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
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
    await client.rpc.getBalance(sharedEscrow).send()
  ).value;

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // This is a linear Trade pool with a shared escrow, so funds come from the escrow.
  //
  // Because this is a sell our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;

  // Compounding is off so the shared escrow loses the full price.
  const lamportsTaken = price;

  t.assert(postSharedEscrowBalance === preSharedEscrowBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Shared escrow pools should have an amount of 0.
  t.assert(updatedPoolAccount.data.amount === 0n);
});

test('it can sell an NFT into a Token pool', async (t) => {
  const client = createDefaultSolanaClient();
  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    await getTestSigners(client);

  const config = tokenPoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer: poolOwner,
    whitelist,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL
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

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const [poolOwnerAta] = await findAtaPda({ mint, owner: poolOwner.address });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
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
  const poolOwnerAtaAccount = await client.rpc
    .getAccountInfo(poolOwnerAta, { encoding: 'base64' })
    .send();

  const ownerAtaData = poolOwnerAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(ownerAtaData);
  const tokenOwner = getTokenOwner(ownerAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === poolOwner.address);

  // Fee vault balance increases.
  const postSaleFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(postSaleFeeVaultBalance > startingFeeVaultBalance);

  // This is a Token pool without a shared escrow, so funds come from the pool.
  // Token pools do not get the mmFee.
  t.assert(postPoolBalance === prePoolBalance - config.startingPrice);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - price for the sale.
  t.assert(
    updatedPoolAccount.data.amount === depositAmount - config.startingPrice
  );
});

test('token pool autocloses when currency amount drops below current price', async (t) => {
  const client = createDefaultSolanaClient();
  const {
    payer,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = await getTestSigners(client);

  const config = tokenPoolConfig;
  const depositAmount = config.startingPrice + 50_000_000n; // 1.5x the starting price

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer, // Original rent payer
    whitelist,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer, // test generic payer
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL
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

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  const startingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address, // rent payer
    pool,
    whitelist,
    mint,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
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

  // The amount left in the pool should be less than the current price so the pool should be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Remaining funds should be returned to the pool owner.
  const endingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  t.assert(
    startingPoolOwnerBalance <=
      endingPoolOwnerBalance + (poolBalance - config.startingPrice)
  );
});

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const config = tokenPoolConfig;
  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL

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

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool

  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const config = tradePoolConfig;
  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL
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

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
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

  // Need one assertion directly in test.
  t.pass();
});

test('it can sell an NFT into a trade pool w/ set cosigner', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority, cosigner } =
    await getTestSigners(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
    cosigner,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: whitelist,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address],
    cosigner: cosigner,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const data = poolAtaAccount!.value!.data;

  const postSellTokenAmount = getTokenAmount(data);
  const postSellTokenOwner = getTokenOwner(data);

  t.assert(postSellTokenAmount === 1n);
  t.assert(postSellTokenOwner === pool);
});

test('it cannot sell an NFT into a trade pool w/ incorrect cosigner', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority, cosigner } =
    await getTestSigners(client);

  // Incorrect Cosigner
  const arbitraryCosigner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
    cosigner: cosigner,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool without specififying cosigner
  const sellNftIxNoCosigner = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address],
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

  // Sell NFT into pool with arbitraryCosigner
  const sellNftIxIncorrectCosigner = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist,
    minPrice,
    creators: [nftUpdateAuthority.address],
    cosigner: arbitraryCosigner,
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

test('it cannot sell an NFT into a token pool w/ incorrect whitelist', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  // Mint Whitelist Authority
  const mintWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  const config = tokenPoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist: poolWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: mintWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: mintWhitelistAuthority,
    conditions: [{ mode: Mode.FVC, value: mintWhitelistAuthority.address }],
  });

  // Create pool w/ poolWhitelist as whitelist
  const { pool } = await createPool({
    client,
    whitelist: poolWhitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: mintWhitelistAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool w/ specifying pool's whitelist & non-matching mint
  const sellNftIxPoolWL = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: poolWhitelist,
    minPrice: minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promisePoolWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxPoolWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promisePoolWL,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Sell NFT into pool w/ specifying mint's whitelist & non-matching pool
  const sellNftIxMintWL = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: mintWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it cannot sell an NFT into a trade pool w/ incorrect whitelist', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  // Mint Whitelist Authority
  const mintWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist: poolWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: mintWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: mintWhitelistAuthority,
    conditions: [{ mode: Mode.FVC, value: mintWhitelistAuthority.address }],
  });

  // Create pool w/ poolWhitelist as whitelist
  const { pool } = await createPool({
    client,
    whitelist: poolWhitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: mintWhitelistAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool w/ specifying pool's whitelist & non-matching mint
  const sellNftIxPoolWL = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: poolWhitelist,
    minPrice: minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promisePoolWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxPoolWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promisePoolWL,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Sell NFT into pool w/ specifying mint's whitelist & non-matching pool
  const sellNftIxMintWL = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: mintWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it can sell a pNFT into a trade pool and pay the correct amount of royalties', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const creator = {
    address: nftUpdateAuthority.address,
    verified: true,
    share: 100,
  } as Creator;

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: nftUpdateAuthority,
    conditions: [{ mode: Mode.FVC, value: creator.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Deposit sol into pool
  const depositIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint a ProgrammableNonFungible.
  const { mint, metadata } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    standard: TokenStandard.ProgrammableNonFungible,
    creators: [creator],
  });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  const { sellerFeeBasisPoints } = (await fetchMetadata(client.rpc, metadata))
    .data;

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  const exactBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    excludeMMFee: true,
  });

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    rentPayer: payer.address,
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    // Remaining accounts
    creators: [creator.address],
  });

  // Use higher CU limit, pNFTs expensive
  const cuLimitIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const data = poolAtaAccount!.value!.data;

  const postSellTokenAmount = getTokenAmount(data);
  const postSellTokenOwner = getTokenOwner(data);

  t.assert(postSellTokenAmount === 1n);
  t.assert(postSellTokenOwner === pool);

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Creator receives exactly the sellerFeeBasisPoints specified in pNFTs metadata of the buy price
  // postBalance === preBalance + bidPrice * sellerFeeBasisPoints / 100_00
  const endingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  t.assert(
    endingCreatorBalance ===
      startingCreatorBalance +
        (BigInt(sellerFeeBasisPoints) * BigInt(exactBidPrice!)) / 100_00n
  );
});

test('pool owner cannot perform a sandwich attack on a seller on a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
      pNft: true,
    });

  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint,
    minPrice, // exact price + mm_fees + royalties
    tokenStandard: TokenStandard.ProgrammableNonFungible,
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
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
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
  const { mint } = nft;

  let sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('it can sell a NFT into a token pool w/ Merkle root whitelist', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      whitelistMode: Mode.MerkleTree,
      useSharedEscrow: false,
      fundPool: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    mint,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool owner.
  assertTokenNftOwnedBy({ t, client, mint, owner: poolOwner.address });
});

test('it can sell a NFT into a trade pool w/ Merkle root whitelist', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      whitelistMode: Mode.MerkleTree,
      useSharedEscrow: false,
      fundPool: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    mint,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  assertTokenNftOwnedBy({ t, client, mint, owner: pool });
});

test('token pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
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
  const { mint } = nft;

  let sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});
