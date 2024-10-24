import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  TokenStandard,
  createDefaultNft,
} from '@tensor-foundation/mpl-token-metadata';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  TSWAP_PROGRAM_ID,
  assertTokenNftOwnedBy,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  PoolType,
  TENSOR_AMM_ERROR__WRONG_POOL_TYPE,
  fetchMaybeNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositNftInstructionAsync,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  getWithdrawNftInstructionAsync,
} from '../../src/index.js';
import {
  COMPUTE_500K_IX,
  ONE_SOL,
  TestAction,
  assertNftReceiptClosed,
  createPool,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  tradePoolConfig,
} from '../_common.js';
import { COMPAT_RULESET, setupLegacyTest } from './_common.js';

test('it can withdraw an NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

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
  const { mint } = await createDefaultNft({
    client,
    payer: nftOwner,
    authority: nftOwner,
    owner: nftOwner.address,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: ONE_SOL,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: owner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftOwner.address],
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

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // Withdraw NFT from pool
  const withdrawNftIx = await getWithdrawNftInstructionAsync({
    owner,
    pool,
    mint,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the owner.
  const ownerAtaAccount = await client.rpc
    .getAccountInfo(ownerAta, { encoding: 'base64' })
    .send();

  const data = ownerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === owner.address);

  // Deposit Receipt should be closed
  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);
});

test('it cannot withdraw an NFT from a Trade pool with wrong owner', async (t) => {
  const client = createDefaultSolanaClient();
  const owner = await generateKeyPairSignerWithSol(client);
  const notOwner = await generateKeyPairSignerWithSol(client);
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
    whitelist,
    owner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
  });

  // Deposit NFT into pool
  const depositNftIx = await getDepositNftInstructionAsync({
    owner: owner,
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

  // Withdraw NFT from pool with bad owner
  const withdrawNftIxBadOwner = await getWithdrawNftInstructionAsync({
    owner: notOwner,
    pool,
    mint,
  });

  const POOL_SEEDS_VIOLATION_ERROR_CODE = 2006;

  const promiseBadOwner = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(withdrawNftIxBadOwner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  // Throws POOL_SEEDS_VIOLATION error
  await expectCustomError(t, promiseBadOwner, POOL_SEEDS_VIOLATION_ERROR_CODE);

  // And NFT is still owned by the pool.
  const poolAtaAccountAfter = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaDataAfter = poolAtaAccountAfter!.value!.data;

  const tokenAmountAfter = getTokenAmount(poolAtaDataAfter);
  const tokenOwnerAfter = getTokenOwner(poolAtaDataAfter);

  t.assert(tokenAmountAfter === 1n);
  t.assert(tokenOwnerAfter === pool);
});

test('it can withdraw an NFT from a NFT pool', async (t) => {
  const { client, pool, nft, signers } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftInstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now custodied by the owner again.
  await assertTokenNftOwnedBy({
    t,
    client,
    mint: nft.mint,
    owner: signers.poolOwner.address,
  });

  // NFT deposit receipt is closed.
  await assertNftReceiptClosed({ t, client, mint: nft.mint, pool });
});

test('it cannot withdraw an NFT from a NFT pool with wrong owner', async (t) => {
  const { client, pool, nft } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });

  const notPoolOwner = await generateKeyPairSignerWithSol(client);

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftInstructionAsync({
    owner: notPoolOwner,
    pool,
    mint: nft.mint,
  });

  const promise = pipe(
    await createDefaultTransaction(client, notPoolOwner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Throws constraint seeds error
  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('deposit and immediately withdraw w/ no sell or buy', async (t) => {
  const { client, pool, signers, nft } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const withdrawNftIx = await getWithdrawNftInstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(withdrawNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
});

test('withdraw from a token pool fails', async (t) => {
  const { client, pool, signers, nft } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
  });

  const withdrawNftIx = await getWithdrawNftInstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(withdrawNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('withdraw pNFT w/ no ruleset', async (t) => {
  const { client, pool, signers, nft } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    pNft: true,
  });

  const withdrawNftIx = await getWithdrawNftInstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
    (tx) => appendTransactionMessageInstruction(withdrawNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
});

test('withdraw pNFT w/ compat ruleset', async (t) => {
  const { client, pool, signers, nft } = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: false,
    pNft: true,
    ruleset: COMPAT_RULESET,
  });

  const withdrawNftIx = await getWithdrawNftInstructionAsync({
    owner: signers.poolOwner,
    pool,
    mint: nft.mint,
    authorizationRules: COMPAT_RULESET,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  });

  await pipe(
    await createDefaultTransaction(client, signers.poolOwner),
    (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
    (tx) => appendTransactionMessageInstruction(withdrawNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
});
