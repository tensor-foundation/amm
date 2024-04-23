import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  address,
  airdropFactory,
  appendTransactionInstruction,
  getProgramDerivedAddress,
  getStringEncoder,
  getU8Encoder,
  isSolanaError,
  lamports,
  none,
  pipe,
} from '@solana/web3.js';
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
import bs58 from 'bs58';
import {
  AMM_PROGRAM_ADDRESS,
  CurveType,
  PoolConfig,
  PoolType,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositSolInstruction,
  getSellNftTradePoolInstruction,
  getWithdrawSolInstruction,
  isSol,
} from '../src/index.js';
import {
  DEFAULT_PUBKEY,
  createPool,
  createWhitelistV2,
  findAtaPda,
  getTokenAmount,
  getTokenOwner,
} from './_common.js';

test('it can withdraw Sol from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
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
    await createDefaultTransaction(client, owner),
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
    // Remaining accounts
    creators: [nftOwner.address],
    ammProgram: AMM_PROGRAM_ADDRESS,
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

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  const preOwnerBalance = (await client.rpc.getBalance(owner.address).send())
    .value;

  const withdrawLamports = 1_000_000n;
  const txFee = 5_000n;

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: withdrawLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const postOwnerBalance = (await client.rpc.getBalance(owner.address).send())
    .value;

  t.assert(postOwnerBalance === preOwnerBalance + withdrawLamports - txFee);
});

test('it cannot withdraw all SOL from a pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const depositLamports = 10_000_000n;
  // Min rent for POOL_SIZE account
  const keepAliveLamports = 3090240n;

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: depositLamports + keepAliveLamports,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // PoolKeepAlive
  const code = 12039;

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
});

test('withdrawing Sol from a Trade pool decreases currency amount', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const depositLamports = 10n * config.startingPrice;
  const withdrawLamports = 5n * config.startingPrice;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  let poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner,
    lamports: depositLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  poolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(poolAccount.data.currency));

  // Currency amount should be what was deposited.
  t.assert(poolAccount.data.amount === depositLamports);

  // Withdraw SOL from pool
  const withdrawSolIx = getWithdrawSolInstruction({
    owner,
    pool,
    lamports: withdrawLamports,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionInstruction(withdrawSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  poolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(poolAccount.data.currency));

  // Currency amount should be what was deposited minues what was withdrawn.
  t.assert(poolAccount.data.amount === depositLamports - withdrawLamports);
});
