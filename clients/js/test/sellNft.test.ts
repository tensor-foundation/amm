import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  address,
  airdropFactory,
  appendTransactionInstruction,
  getProgramDerivedAddress,
  getStringEncoder,
  getU8Encoder,
  lamports,
  none,
  pipe,
} from '@solana/web3.js';
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
import bs58 from 'bs58';
import {
  AMM_PROGRAM_ADDRESS,
  CurveType,
  Pool,
  PoolConfig,
  PoolType,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositSolInstruction,
  getSellNftTokenPoolInstruction,
  getSellNftTradePoolInstruction,
  isSol,
} from '../src/index.js';
import {
  BASIS_POINTS,
  DEFAULT_PUBKEY,
  MAKER_REBATE_BPS,
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
} from './_common.js';

test('it can sell an NFT into a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 100_000n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const depositAmount = config.startingPrice * 10n;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: buyer,
    owner,
    config,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
    funded: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);
  t.assert(poolAccount.data.config.mmFeeBps === 100);

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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    cosigner,
    minPrice,
    rulesAccPresent: false,
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

  // Because this is a sell our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;
  const makerRebate = (price * MAKER_REBATE_BPS) / BASIS_POINTS;

  // The pool pays out the current_price - mm_fees, if compounded, and maker rebate.
  // In this case, no compounding, so the pool pays out the full price - makerRebate.
  const lamportsTaken = price - makerRebate;

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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow,
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    cosigner,
    minPrice,
    rulesAccPresent: false,
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

  // Because this is a sell our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;
  const makerRebate = (price * MAKER_REBATE_BPS) / BASIS_POINTS;

  // Shared escrow loses the price minus the maker rebate.
  const lamportsTaken = price - makerRebate;

  t.assert(postSharedEscrowBalance === preSharedEscrowBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Shared escrow pools should have an amount of 0.
  t.assert(updatedPoolAccount.data.amount === 0n);
});

test('it can sell an NFT into a Token pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: null,
  };

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

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Last byte of mint address is the fee vault shard number.
  const mintBytes = bs58.decode(mint);
  const lastByte = mintBytes[mintBytes.length - 1];

  const [feeVault] = await getProgramDerivedAddress({
    programAddress: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),
    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),
      getU8Encoder().encode(lastByte),
    ],
  });

  // Fund fee vault with min rent lamports.
  await airdropFactory(client)({
    recipientAddress: feeVault,
    lamports: lamports(890880n),
    commitment: 'confirmed',
  });

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

  const minPrice = 900_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTokenPoolInstruction({
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
    ownerAta,
    sellerTokenRecord,
    ownerTokenRecord,
    poolTokenRecord,
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    cosigner,
    minPrice,
    rulesAccPresent: false,
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
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
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
  // In this case, the taker receives the price minus the maker fee rebate.
  // Token pools do not get the mmFee.
  const makerRebate = (config.startingPrice * MAKER_REBATE_BPS) / BASIS_POINTS;

  const lamportsTaken = config.startingPrice - makerRebate;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);
});

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 100n * ONE_SOL);

  const nftOwner = await generateKeyPairSignerWithSol(client);

  const buyer = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Token,

    curveType: CurveType.Linear,

    startingPrice: 1_000_000n,

    delta: 0n,

    mmCompoundFees: false,

    mmFeeBps: null,
  };

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

  // Last byte of mint address is the fee vault shard number.

  const mintBytes = bs58.decode(mint);

  const lastByte = mintBytes[mintBytes.length - 1];

  const [feeVault] = await getProgramDerivedAddress({
    programAddress: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),

    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),

      getU8Encoder().encode(lastByte),
    ],
  });

  // Fund fee vault with min rent lamports.

  await airdropFactory(client)({
    recipientAddress: feeVault,

    lamports: lamports(890880n),

    commitment: 'confirmed',
  });

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

  const minPrice = 900_000n;

  // Sell NFT into pool

  const sellNftIx = getSellNftTokenPoolInstruction({
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

    ownerAta,

    sellerTokenRecord,

    ownerTokenRecord,

    poolTokenRecord,

    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,

    instructions: SYSVARS_INSTRUCTIONS,

    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,

    authRules: DEFAULT_PUBKEY,

    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now

    takerBroker: owner.address, // No taker broker so we put a dummy here for now

    cosigner,

    minPrice,

    rulesAccPresent: false,

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

  const config: PoolConfig = {
    poolType: PoolType.Trade,

    curveType: CurveType.Linear,

    startingPrice: 1_000_000n,

    delta: 0n,

    mmCompoundFees: false,

    mmFeeBps: 100,
  };

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

  // Last byte of mint address is the fee vault shard number.

  const mintBytes = bs58.decode(mint);

  const lastByte = mintBytes[mintBytes.length - 1];

  const [feeVault] = await getProgramDerivedAddress({
    programAddress: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),

    seeds: [
      getStringEncoder({ size: 'variable' }).encode('fee_vault'),

      getU8Encoder().encode(lastByte),
    ],
  });

  // Fund fee vault with min rent lamports.

  await airdropFactory(client)({
    recipientAddress: feeVault,

    lamports: lamports(890880n),

    commitment: 'confirmed',
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

  const minPrice = 900_000n;

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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    cosigner,
    minPrice,
    rulesAccPresent: false,
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
