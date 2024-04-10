import test from 'ava';
import bs58 from 'bs58';
import {} from '@solana/programs';
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
  some,
} from '@solana/web3.js';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  SYSVARS_INSTRUCTIONS,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import {
  fetchPool,
  findNftDepositReceiptPda,
  PoolType,
  CurveType,
  getDepositSolInstruction,
  PoolConfig,
  getSellNftTradePoolInstruction,
  getBuyNftInstruction,
} from '../src/index.js';
import {
  DEFAULT_PUBKEY,
  createPool,
  createWhitelistV2,
  findAtaPda,
  getTokenAmount,
  getTokenOwner,
} from './_common.js';

test('it can buy an NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: some(100),
  };

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

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
    lamports: 10_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
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
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });
  const [buyerTokenRecord] = await findTokenRecordPda({
    mint,
    token: buyerAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const minPrice = 900_000n;
  const maxPrice = 1_100_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    rentPayer: nftOwner, // seller
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
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner.address),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
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

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
    rentPayer: buyer,
    owner: owner.address,
    buyer,
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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    maxPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    program: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),
  });

  await pipe(
    await createDefaultTransaction(client, buyer.address),
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
});

test.only('buyNft emits a self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);
  const buyer = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: some(100),
  };

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

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
    lamports: 10_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
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
  const [buyerAta] = await findAtaPda({ mint, owner: buyer.address });

  const [sellerTokenRecord] = await findTokenRecordPda({
    mint,
    token: sellerAta,
  });
  const [poolTokenRecord] = await findTokenRecordPda({
    mint,
    token: poolAta,
  });
  const [buyerTokenRecord] = await findTokenRecordPda({
    mint,
    token: buyerAta,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  const minPrice = 900_000n;
  const maxPrice = 1_100_000n;

  // Sell NFT into pool
  const sellNftIx = getSellNftTradePoolInstruction({
    rentPayer: nftOwner, // seller
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
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner.address),
    (tx) => appendTransactionInstruction(computeIx, tx),
    (tx) => appendTransactionInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
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

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
    rentPayer: buyer,
    owner: owner.address,
    buyer,
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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    sharedEscrow: poolAta, // No shared escrow so we put a dummy account here for now
    takerBroker: owner.address, // No taker broker so we put a dummy here for now
    maxPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [nftOwner.address],
    program: address('TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'),
  });

  const sig = await pipe(
    await createDefaultTransaction(client, buyer.address),
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

  console.log('sig', sig);
});
