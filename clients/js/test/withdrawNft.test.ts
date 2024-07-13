import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
} from '@tensor-foundation/mpl-token-metadata';
import test from 'ava';
import {
  PoolType,
  fetchMaybeNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositSolInstruction,
  getSellNftTradePoolInstructionAsync,
  getWithdrawNftInstructionAsync,
} from '../src/index.js';
import {
  createPool,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  tradePoolConfig,
} from './_common.js';

test('it can withdraw an NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: 2, value: nftOwner.address }],
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
  const { mint } = await createDefaultNft(
    client,
    nftOwner,
    nftOwner,
    nftOwner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner,
    lamports: 10_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVault = await getAndFundFeeVault(client, pool);

  const [ownerAta] = await findAtaPda({ mint, owner: owner.address });
  const [poolAta] = await findAtaPda({ mint, owner: pool });

  const minPrice = 850_000n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: owner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
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

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftInstructionAsync({
    owner,
    pool,
    mint,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
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
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(client.rpc, nftReceipt);
  t.assert(maybeNftReceipt.exists === false);
});
