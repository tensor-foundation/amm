import { appendTransactionInstruction, none, pipe } from '@solana/web3.js';
import {
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
  PoolType,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftInstruction,
  getDepositNftInstruction,
  isSol,
} from '../src/index.js';
import {
  BASIS_POINTS,
  assertTammNoop,
  createPool,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  nftPoolConfig,
  tradePoolConfig,
} from './_common.js';

test('it can buy an NFT from a Trade pool', async (t) => {
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

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  const maxPrice = 1_100_000n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  const {
    mint,
    metadata,
    masterEdition,
    token: ownerAta,
  } = await createDefaultNft(client, owner, owner, owner);

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });
  const [buyerTokenRecord] = await findTokenRecordPda({
    mint,
    token: buyerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  // Deposit NFT
  const depositNftIx = getDepositNftInstruction({
    owner,
    pool,
    whitelist,
    ownerAta,
    poolAta,
    mint,
    metadata,
    nftReceipt,
    edition: masterEdition,
    ownerTokenRecord,
    poolTokenRecord,
    authorizationData: none(),
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

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

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
    owner: owner.address,
    buyer,
    rentPayer: owner.address,
    feeVault,
    pool,
    poolAta,
    buyerAta: buyerAta,
    mint,
    metadata,
    edition: masterEdition,
    poolTokenRecord,
    buyerTokenRecord,
    nftReceipt,
    maxPrice,
    authorizationData: none(),
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);
});

test('buying NFT from a trade pool increases currency amount', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const takerBroker = await generateKeyPairSignerWithSol(client);
  const makerBroker = await generateKeyPairSignerWithSol(client);

  const config = {
    ...tradePoolConfig,
    mmCompoundFees: true,
  };

  const maxPrice = 1_100_000n;

  // Create whitelist with FVC where the owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer: buyer,
    whitelist,
    makerBroker: makerBroker.address,
    owner,
    config,
  });

  // Balance of pool before any sales operations.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT -- Pool owner owns it so they can deposit it.
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });
  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });
  const [buyerTokenRecord] = await findTokenRecordPda({
    mint,
    token: buyerAta,
  });

  // Deposit NFT into pool
  const depositNftIx = getDepositNftInstruction({
    owner,
    pool,
    whitelist,
    poolAta,
    ownerAta,
    mint,
    metadata,
    edition: masterEdition,
    nftReceipt,
    poolTokenRecord,
    ownerTokenRecord,
    authorizationData: none(),
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

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

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
    owner: owner.address,
    buyer,
    rentPayer: owner.address,
    feeVault,
    pool,
    poolAta,
    buyerAta: buyerAta,
    mint,
    metadata,
    edition: masterEdition,
    poolTokenRecord,
    buyerTokenRecord,
    nftReceipt,
    takerBroker: takerBroker.address,
    makerBroker: makerBroker.address,
    maxPrice,
    authorizationData: none(),
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

  // This is a Trade pool with mm compound fees so funds go to the pool instead of straight through to the pool's owner.
  // The pool's post balance should be the pre-balance plus the price paid for the NFT plus the mm fee.
  const mmFee =
    (config.startingPrice * BigInt(config.mmFeeBps ?? 0)) / BASIS_POINTS;

  const lamportsAdded = config.startingPrice + mmFee;

  t.assert(postPoolBalance === prePoolBalance + lamportsAdded);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one buy so the pool currency amount should just be the new lamports added.
  t.assert(updatedPoolAccount.data.amount === lamportsAdded);
});

test('buyNft emits a self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const maxPrice = 1_100_000n;

  // Create whitelist with FVC where the owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT -- Pool owner owns it so they can deposit it.
  const { mint, metadata, masterEdition } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });
  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
  });
  const [buyerTokenRecord] = await findTokenRecordPda({
    mint,
    token: buyerAta,
  });

  // Deposit NFT into pool
  const depositNftIx = getDepositNftInstruction({
    owner,
    pool,
    whitelist,
    poolAta,
    ownerAta,
    mint,
    metadata,
    edition: masterEdition,
    nftReceipt,
    poolTokenRecord,
    ownerTokenRecord,
    authorizationData: none(),
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

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

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
    owner: owner.address,
    buyer,
    rentPayer: owner.address,
    feeVault,
    pool,
    poolAta,
    buyerAta: buyerAta,
    mint,
    metadata,
    edition: masterEdition,
    poolTokenRecord,
    buyerTokenRecord,
    nftReceipt,
    maxPrice,
    authorizationData: none(),
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

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

  const maxPrice = 1_100_000n;

  let poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.NFT);

  // Mint NFTs
  const {
    mint: mint1,
    metadata: metadata1,
    masterEdition: masterEdition1,
    token: ownerAta1,
  } = await createDefaultNft(client, owner, owner, owner);

  const {
    mint: mint2,
    metadata: metadata2,
    masterEdition: masterEdition2,
    token: ownerAta2,
  } = await createDefaultNft(client, owner, owner, owner);

  const [poolAta1] = await findAtaPda({ mint: mint1, owner: pool });
  const [buyerAta1] = await findAtaPda({ mint: mint1, owner: buyer.address });

  const [poolAta2] = await findAtaPda({ mint: mint2, owner: pool });
  const [buyerAta2] = await findAtaPda({ mint: mint2, owner: buyer.address });

  const [ownerTokenRecord1] = await findTokenRecordPda({
    mint: mint1,
    token: ownerAta1,
  });
  const [buyerTokenRecord1] = await findTokenRecordPda({
    mint: mint1,
    token: buyerAta1,
  });
  const [poolTokenRecord1] = await findTokenRecordPda({
    mint: mint1,
    token: poolAta1,
  });

  const [ownerTokenRecord2] = await findTokenRecordPda({
    mint: mint2,
    token: ownerAta2,
  });
  const [buyerTokenRecord2] = await findTokenRecordPda({
    mint: mint2,
    token: buyerAta2,
  });
  const [poolTokenRecord2] = await findTokenRecordPda({
    mint: mint2,
    token: poolAta2,
  });

  const [nftReceipt1] = await findNftDepositReceiptPda({ mint: mint1, pool });
  const [nftReceipt2] = await findNftDepositReceiptPda({ mint: mint2, pool });

  // Deposit NFTs
  const depositNftIx1 = getDepositNftInstruction({
    owner,
    pool,
    whitelist,
    ownerAta: ownerAta1,
    poolAta: poolAta1,
    mint: mint1,
    metadata: metadata1,
    nftReceipt: nftReceipt1,
    edition: masterEdition1,
    ownerTokenRecord: ownerTokenRecord1,
    poolTokenRecord: poolTokenRecord1,
    authorizationData: none(),
  });

  const depositNftIx2 = getDepositNftInstruction({
    owner,
    pool,
    whitelist,
    ownerAta: ownerAta2,
    poolAta: poolAta2,
    mint: mint2,
    metadata: metadata2,
    nftReceipt: nftReceipt2,
    edition: masterEdition2,
    ownerTokenRecord: ownerTokenRecord2,
    poolTokenRecord: poolTokenRecord2,
    authorizationData: none(),
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositNftIx1, tx),
    (tx) => appendTransactionInstruction(depositNftIx2, tx),
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

  const feeVault = await getAndFundFeeVault(client, pool);

  // Buy the first NFT from pool
  const buyNftIx1 = getBuyNftInstruction({
    owner: owner.address,
    buyer,
    rentPayer: rentPayer.address,
    feeVault,
    pool,
    poolAta: poolAta1,
    buyerAta: buyerAta1,
    mint: mint1,
    metadata: metadata1,
    edition: masterEdition1,
    poolTokenRecord: poolTokenRecord1,
    buyerTokenRecord: buyerTokenRecord1,
    nftReceipt: nftReceipt1,
    maxPrice,
    authorizationData: none(),
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionInstruction(buyNftIx1, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Pool is still open
  poolAccount = await fetchPool(client.rpc, pool);
  t.assert(poolAccount.data.config.poolType === PoolType.NFT);

  // Buy the second NFT from pool
  const buyNftIx2 = getBuyNftInstruction({
    owner: owner.address,
    buyer,
    rentPayer: rentPayer.address,
    feeVault,
    pool,
    poolAta: poolAta2,
    buyerAta: buyerAta2,
    mint: mint2,
    metadata: metadata2,
    edition: masterEdition2,
    poolTokenRecord: poolTokenRecord2,
    buyerTokenRecord: buyerTokenRecord2,
    nftReceipt: nftReceipt2,
    maxPrice,
    authorizationData: none(),
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionInstruction(buyNftIx2, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Pool is now closed as there are no more NFTs left to buy.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);
});
