import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  TSWAP_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  PoolType,
  fetchMaybeNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositNftCoreInstructionAsync,
  getDepositSolInstruction,
  getSellNftTradePoolCoreInstructionAsync,
  getWithdrawNftCoreInstructionAsync,
} from '../../src/index.js';
import {
  ONE_SOL,
  createPool,
  createWhitelistV2,
  expectCustomError,
  getAndFundFeeVault,
  tradePoolConfig,
} from '../_common.js';
import {
  AssetV1,
  createAsset,
  fetchAssetV1,
  PluginAuthorityPairArgs,
  VerifiedCreatorsArgs,
} from '@tensor-foundation/mpl-core';

test('it can withdraw an NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const owner = await generateKeyPairSignerWithSol(client, 5n * ONE_SOL);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  const verifiedCreators: [VerifiedCreatorsArgs] = [
    {
      signatures: [
        {
          address: nftUpdateAuthority.address,
          verified: true,
        },
      ],
    },
  ];

  const plugins: PluginAuthorityPairArgs[] = [
    {
      plugin: {
        __kind: 'VerifiedCreators',
        fields: verifiedCreators,
      },
      authority: { __kind: 'UpdateAuthority' },
    },
  ];

  // Mint NFT
  const asset = await createAsset({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    plugins,
    name: 'Test',
    uri: 'https://test.com',
  });

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
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

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolCoreInstructionAsync({
    owner: owner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    feeVault,
    pool,
    whitelist,
    asset: asset.address,
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
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });

  // Withdraw NFT from pool
  const buyNftIx = await getWithdrawNftCoreInstructionAsync({
    owner,
    pool,
    asset: asset.address,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the owner.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: owner.address,
    },
  });

  // Deposit Receipt should be closed
  const [nftReceipt] = await findNftDepositReceiptPda({
    mint: asset.address,
    pool,
  });
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

  const verifiedCreators: [VerifiedCreatorsArgs] = [
    {
      signatures: [
        {
          address: owner.address,
          verified: true,
        },
      ],
    },
  ];

  const plugins: PluginAuthorityPairArgs[] = [
    {
      plugin: {
        __kind: 'VerifiedCreators',
        fields: verifiedCreators,
      },
      authority: { __kind: 'UpdateAuthority' },
    },
  ];

  // Mint NFT
  const asset = await createAsset({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
    plugins,
    name: 'Test',
    uri: 'https://test.com',
  });

  // Deposit NFT into pool
  const depositNftIx = await getDepositNftCoreInstructionAsync({
    owner: owner,
    pool,
    whitelist,
    asset: asset.address,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });

  // Withdraw NFT from pool with bad owner
  const withdrawNftIxBadOwner = await getWithdrawNftCoreInstructionAsync({
    owner: notOwner,
    pool,
    asset: asset.address,
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
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: pool,
    },
  });
});
