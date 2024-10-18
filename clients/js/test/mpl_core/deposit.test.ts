import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  createAsset,
  createDefaultAsset,
  PluginAuthorityPairArgs,
  VerifiedCreatorsArgs,
} from '@tensor-foundation/mpl-core';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  expectCustomError,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  fetchWhitelistV2,
  getUpdateWhitelistV2Instruction,
  Mode,
  operation,
  TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION,
  TENSOR_WHITELIST_ERROR__FAILED_MERKLE_PROOF_VERIFICATION,
  TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositNftCoreInstructionAsync,
  PoolConfig,
  PoolType,
} from '../../src/index.js';
import { createPool, createWhitelistV2 } from '../_common.js';

test('deposit non-whitelisted NFT fails', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const creator = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const fvcConditions = [{ mode: Mode.FVC, value: creator.address }];
  const vocConditions = [{ mode: Mode.VOC, value: creator.address }];
  const merkleTreeConditions = [
    { mode: Mode.MerkleTree, value: creator.address },
  ];

  // Create whitelist with FVC
  // use a separate keypair so NFT isn't part of this whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: fvcConditions,
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
  const asset = await createDefaultAsset({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({
    mint: asset.address,
    pool,
  });

  // Deposit NFT
  let depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
    nftReceipt,
  });

  let promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Update whitelist to use VOC
  let updateWhitelistIx = getUpdateWhitelistV2Instruction({
    payer: owner,
    updateAuthority: owner,
    whitelist,
    freezeAuthority: operation('Noop'),
    conditions: vocConditions,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(updateWhitelistIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.like(await fetchWhitelistV2(client.rpc, whitelist), {
    data: {
      conditions: vocConditions,
    },
  });

  // Deposit NFT
  depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
    nftReceipt,
  });

  promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION
  );

  // Update whitelist to use Merkle Tree
  updateWhitelistIx = getUpdateWhitelistV2Instruction({
    payer: owner,
    updateAuthority: owner,
    whitelist,
    freezeAuthority: operation('Noop'),
    conditions: merkleTreeConditions,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(updateWhitelistIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.like(await fetchWhitelistV2(client.rpc, whitelist), {
    data: {
      conditions: merkleTreeConditions,
    },
  });

  // Deposit NFT
  depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
    nftReceipt,
  });

  promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_MERKLE_PROOF_VERIFICATION
  );
});

test('deposit fails using FVC verification when verified creator is present but is the wrong one', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const secondCreator = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const fvcConditions = [{ mode: Mode.FVC, value: secondCreator.address }];

  // Create whitelist with FVC
  // use a separate keypair so NFT isn't part of this whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: fvcConditions,
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
          address: nftUpdateAuthority.address,
          verified: true, // verified but not the one in the whitelist
        },
        {
          address: secondCreator.address,
          verified: false,
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

  // Mint NFT w/ verified creators plugin
  const asset = await createAsset({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
    plugins,
    name: 'Test',
    uri: 'https://test.com',
  });

  // Deposit NFT
  let depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail to verify because no creators are verified
  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );
});

test('deposit fails using FVC verification when creators array is empty on NFT', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const secondCreator = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const fvcConditions = [{ mode: Mode.FVC, value: secondCreator.address }];

  // Create whitelist with FVC
  // use a separate keypair so NFT isn't part of this whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: fvcConditions,
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
      signatures: [], // empty!
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

  // Mint NFT w/ verified creators plugin
  const asset = await createAsset({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
    plugins,
    name: 'Test',
    uri: 'https://test.com',
  });

  // Deposit NFT
  let depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail to verify because no creators are verified
  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );
});

test('deposit fails VOC verification when no collection is present', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const collection = await generateKeyPairSignerWithSol(client);

  // Mint NFT w/o collection
  const asset = await createDefaultAsset({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
  });

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const vocConditions = [{ mode: Mode.VOC, value: collection.address }];

  // Create whitelist with FVC
  // use a separate keypair so NFT isn't part of this whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: vocConditions,
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Deposit NFT
  let depositNftIx = await getDepositNftCoreInstructionAsync({
    owner,
    pool,
    whitelist,
    asset: asset.address,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail to verify because no creators are verified
  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION
  );
});
