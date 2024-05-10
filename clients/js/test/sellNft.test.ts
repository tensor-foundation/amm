import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { appendTransactionInstruction, none, pipe } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  SYSVARS_INSTRUCTIONS,
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  AMM_PROGRAM_ADDRESS,
  CurveType,
  Pool,
  PoolConfig,
  PoolType,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositSolInstruction,
  getSellNftTokenPoolInstruction,
  getSellNftTradePoolInstruction,
  isSol,
} from '../src/index.js';
import {
  DEFAULT_PUBKEY,
  ONE_SOL,
  assertTammNoop,
  createAndFundEscrow,
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  tokenPoolConfig,
  tradePoolConfig,
} from './_common.js';

test('it can sell an NFT into a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const makerBroker = await generateKeyPairSignerWithSol(client);
  const takerBroker = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: buyer,
    owner,
    makerBroker: makerBroker.address,
    config,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
    funded: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);
  t.assert(poolAccount.data.config.mmFeeBps === 50);

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, mint);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    sellerTokenRecord,
    poolTokenRecord,
    nftReceipt,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
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
});

test('it can sell an NFT into a Trade pool w/ an escrow account', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const makerBroker = await generateKeyPairSignerWithSol(client);
  const takerBroker = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 100_000n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const depositAmount = config.startingPrice * 10n;

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, mint);

  // Create a shared escrow account.
  const sharedEscrow = await createAndFundEscrow(client, owner, feeVault, 1);

  // Starting balance of the shared escrow.
  const preSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow).send()
  ).value;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: buyer,
    owner,
    makerBroker: makerBroker.address,
    config,
    sharedEscrow,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
    funded: false, // cannot deposit to shared escrow pool
  });

  t.like(await fetchPool(client.rpc, pool), <Pool>{
    address: pool,
    data: {
      sharedEscrow,
      config,
    },
  });

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    sellerTokenRecord,
    poolTokenRecord,
    nftReceipt,
    sharedEscrow,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
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

  // const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // // Ensure it's a SOL currency.
  // t.assert(isSol(updatedPoolAccount.data.currency));

  // // Shared escrow pools should have an amount of 0.
  // t.assert(updatedPoolAccount.data.amount === 0n);
});

test('it can sell an NFT into a Token pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const takerBroker = await generateKeyPairSignerWithSol(client);
  const makerBroker = await generateKeyPairSignerWithSol(client);

  const config = tokenPoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    makerBroker: makerBroker.address,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const feeVault = await getAndFundFeeVault(client, mint);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTokenPoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    rentPayer: owner.address,
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    ownerAta,
    sellerTokenRecord,
    ownerTokenRecord,
    poolTokenRecord,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the owner.
  const ownerAtaAccount = await client.rpc
    .getAccountInfo(ownerAta, { encoding: 'base64' })
    .send();

  const ownerAtaData = ownerAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(ownerAtaData);
  const tokenOwner = getTokenOwner(ownerAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === owner.address);

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

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const rentPayer = await generateKeyPairSignerWithSol(client);

  const takerBroker = await generateKeyPairSignerWithSol(client);
  const makerBroker = await generateKeyPairSignerWithSol(client);

  const config = tokenPoolConfig;

  const depositAmount = config.startingPrice + 500_000n; // 1.5 startingPrice

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer: rentPayer,
    whitelist,
    owner,
    makerBroker: makerBroker.address,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, mint);

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTokenPoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    rentPayer: rentPayer.address,
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    ownerAta,
    sellerTokenRecord,
    ownerTokenRecord,
    poolTokenRecord,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // The amount left in the pool should be less than the current price so the pool should be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);
});

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config = tokenPoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist

  const { pool, cosigner } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT

  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL

  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  const feeVault = await getAndFundFeeVault(client, mint);

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });

  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });

  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const minPrice = 850_000n;

  // Sell NFT into pool

  const sellNftIx = getSellNftTokenPoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    rentPayer: owner.address,
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    ownerAta,
    sellerTokenRecord,
    ownerTokenRecord,
    poolTokenRecord,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    ammProgram: AMM_PROGRAM_ADDRESS,
    escrowProgram: TSWAP_PROGRAM_ID,
    // Remaining accounts
    creators: [nftOwner.address],
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  assertTammNoop(t, client, sig);
});

test('sellNftTradePool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();
  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  // Mint NFT
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  const feeVault = await getAndFundFeeVault(client, mint);

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [sellerAta] = await findAtaPda({ mint, owner: nftOwner.address });
  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });

  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });
  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    sellerAta,
    poolAta,
    mint,
    metadata,
    edition: masterEdition,
    sellerTokenRecord,
    poolTokenRecord,
    nftReceipt,
    cosigner,
    minPrice,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    ammProgram: AMM_PROGRAM_ADDRESS,
    // Remaining accounts
    creators: [nftOwner.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  assertTammNoop(t, client, sig);

  // Need one assertion directly in test.
  t.pass();
});
