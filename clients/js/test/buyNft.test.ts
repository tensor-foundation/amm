import { appendTransactionInstruction, none, pipe } from '@solana/web3.js';
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
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  AMM_PROGRAM_ADDRESS,
  PoolType,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftInstruction,
  getDepositNftInstruction,
  isSol,
} from '../src/index.js';
import {
  BASIS_POINTS,
  DEFAULT_PUBKEY,
  assertTammNoop,
  createPool,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
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

  const feeVault = await getAndFundFeeVault(client, mint);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
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
    maxPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
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
    takerBroker: takerBroker.address,
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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
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

  const feeVault = await getAndFundFeeVault(client, mint);

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
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
    takerBroker: takerBroker.address,
    makerBroker: makerBroker.address,
    maxPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
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
    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
    instructions: SYSVARS_INSTRUCTIONS,
    authorizationRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    authRules: DEFAULT_PUBKEY,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
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

  const feeVault = await getAndFundFeeVault(client, mint);

  // Buy NFT from pool
  const buyNftIx = getBuyNftInstruction({
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
    maxPrice,
    rulesAccPresent: false,
    authorizationData: none(),
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    optionalRoyaltyPct: none(),
    // Remaining accounts
    creators: [owner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
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
