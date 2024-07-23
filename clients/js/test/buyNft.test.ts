import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Creator,
  TokenStandard,
  createDefaultNft,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
import test from 'ava';
import {
  NftDepositReceipt,
  Pool,
  PoolType,
  fetchMaybeNftDepositReceipt,
  fetchMaybePool,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftInstructionAsync,
  getDepositNftInstructionAsync,
  isSol,
} from '../src/index.js';
import {
  BASIS_POINTS,
  assertTammNoop,
  createAndFundEscrow,
  createPool,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  nftPoolConfig,
  tradePoolConfig,
} from './_common.js';
import { Mode } from '@tensor-foundation/whitelist';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';

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
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer: buyer,
    whitelist,
    owner,
    config,
  });

  const maxAmount = 1_100_000n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  const { mint } = await createDefaultNft({
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

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

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
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);
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

  const maxAmount = 1_100_000n;

  // Create whitelist with FVC where the owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: owner.address }],
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
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  // Deposit NFT into pool
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
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  await getAndFundFeeVault(client, pool);

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    takerBroker: takerBroker.address,
    makerBroker: makerBroker.address,
    maxAmount,
    // Remaining accounts
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
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

  const maxAmount = 1_100_000n;

  // Create whitelist with FVC where the owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: owner.address }],
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
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner,
  });

  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  // Deposit NFT into pool
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
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  await getAndFundFeeVault(client, pool);

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    // Remaining accounts
    creators: [owner.address],
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
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
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool
  const { pool } = await createPool({
    client,
    payer: rentPayer,
    whitelist,
    owner,
    config,
  });

  const maxAmount = 1_100_000n;

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
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Initialize Margin Acc
  const margin = await createAndFundEscrow(client, owner, 0);

  // Create pool attached to shared escrow
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
    sharedEscrow: margin,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
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

  await getAndFundFeeVault(client, pool);

  const startingEscrowBalance = (await client.rpc.getBalance(margin).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount: config.startingPrice,
    sharedEscrow: margin,
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Shared Escrow balance increases exactly by the pool's startingPrice.
  const endingEscrowBalance = (await client.rpc.getBalance(margin).send())
    .value;
  t.assert(
    startingEscrowBalance === endingEscrowBalance - config.startingPrice
  );
});

test('it can buy an NFT from a pool w/ set cosigner', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);
  // Cosigner
  const cosigner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
    cosigner: cosigner,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
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

  await getAndFundFeeVault(client, pool);

  // Buy NFT from pool
  const buyNftIx = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount: config.startingPrice,
    creators: [owner.address],
    cosigner: cosigner,
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);
});

test('it cannot buy an NFT from a pool w/ incorrect cosigner', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);
  // Cosigner
  const cosigner = await generateKeyPairSignerWithSol(client);
  // Incorrect Cosigner
  const arbitraryCosigner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: owner.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
    cosigner: cosigner,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
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

  // Buy NFT from pool without specififying cosigner
  const buyNftIxNoCosigner = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount: config.startingPrice,
    creators: [owner.address],
  });
  const BAD_COSIGNER_ERROR_CODE = 12025;

  const promiseNoCosigner = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxNoCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseNoCosigner, BAD_COSIGNER_ERROR_CODE);

  // Buy NFT from pool with arbitraryCosigner
  const buyNftIxIncorrectCosigner = await getBuyNftInstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount: config.startingPrice,
    creators: [owner.address],
    cosigner: arbitraryCosigner,
  });

  const promiseIncorrectCosigner = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIxIncorrectCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseIncorrectCosigner, BAD_COSIGNER_ERROR_CODE);
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

  const maxAmount = 1_100_000n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  // @ts-ignore: Mint a ProgrammableNonFungible.
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

  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

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
