import {
  appendTransactionMessageInstruction,
  isSome,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultNft,
  createDefaultNftInCollection,
  fetchMetadata,
  getUnverifyInstruction,
  getVerifyInstruction,
  VerificationArgs,
} from '@tensor-foundation/mpl-token-metadata';
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
  getDepositNftInstructionAsync,
  PoolConfig,
  PoolType,
} from '../../src/index.js';
import { createPool, createWhitelistV2, TestAction } from '../_common.js';
import { COMPAT_RULESET, setupLegacyTest } from './_common.js';

test('it can deposit a legacy Metaplex NFT into a Trade pool w/ FVC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.FVC,
  });
});

test('it can deposit a legacy Metaplex NFT into a Trade pool w/ VOC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });
});

test('it can deposit a legacy Metaplex NFT into a Trade pool w/ Merkle Tree mode', async (t) => {
  // With FVC mode
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('it can deposit a legacy Metaplex NFT into a NFT pool w/ FVC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.FVC,
  });
});

test('it can deposit a legacy Metaplex NFT into a NFT pool w/ VOC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });
});

test('it can deposit a legacy Metaplex NFT into a NFT pool w/ Merkle Tree mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: false,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('it can deposit a Metaplex pNFT into a Trade pool w/ FVC mode', async (t) => {
  // With FVC mode
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.FVC,
  });
});

test('it can deposit a Metaplex pNFT into a Trade pool w/ VOC mode', async (t) => {
  // With FVC mode
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });
});

test('it can deposit a Metaplex pNFT into a Trade pool w/ Merkle Tree mode', async (t) => {
  // With FVC mode
  await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('it can deposit a Metaplex pNFT into a NFT pool w/ FVC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.FVC,
  });
});

test('it can deposit a Metaplex pNFT into a NFT pool w/ VOC mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.VOC,
  });
});

test('it can deposit a Metaplex pNFT into a NFT pool w/ Merkle Tree mode', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('it can deposit a Metaplex pNFT w/ compat ruleset', async (t) => {
  await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    pNft: true,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
    ruleset: COMPAT_RULESET,
  });
});

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
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: owner,
    owner: owner.address,
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  // Deposit NFT
  let depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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
  depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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
  depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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

test('deposits successfully using FVC verification on the 2nd creator', async (t) => {
  // Also: deposit fails using FVC verification when no creators are verified
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

  // Mint NFT
  const { mint, metadata } = await createDefaultNft({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
    creators: [
      {
        share: 100,
        address: nftUpdateAuthority.address,
        verified: false,
      },
      {
        share: 0,
        address: secondCreator.address,
        verified: false, // start unverified
      },
    ],
  });

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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

  // Now verify the second creator.
  const verifyIx = getVerifyInstruction({
    authority: secondCreator,
    metadata,
    verificationArgs: VerificationArgs.CreatorV1,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(verifyIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Ensure the second creator is verified.
  const md = await fetchMetadata(client.rpc, metadata);

  t.assert(
    isSome(md.data.creators) &&
      md.data.creators.value.some(
        (c) => c.address === secondCreator.address && c.verified
      )
  );

  // Deposit should succeed now.
  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
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

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
    creators: [
      {
        share: 100,
        address: nftUpdateAuthority.address,
        verified: true, // verified but not the one in the whitelist
      },
      {
        share: 0,
        address: secondCreator.address,
        verified: false,
      },
    ],
  });

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
    creators: null, // empty!
  });

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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

test('deposit fails VOC verification when collection is not verified', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);

  // Mint NFT w/ collection
  const { collection, item: nft } = await createDefaultNftInCollection({
    client,
    payer: owner,
    authority: nftUpdateAuthority,
    owner: owner.address,
  });

  // Unverify the collection
  const unverifyIx = getUnverifyInstruction({
    authority: nftUpdateAuthority,
    metadata: nft.metadata,
    collectionMint: collection.mint,
    collectionMetadata: collection.metadata,
    verificationArgs: VerificationArgs.CollectionV1,
  });

  await pipe(
    await createDefaultTransaction(client, nftUpdateAuthority),
    (tx) => appendTransactionMessageInstruction(unverifyIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  const vocConditions = [{ mode: Mode.VOC, value: collection.mint }];

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

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Deposit NFT
  let depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint: nft.mint,
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

  // Verify the collection
  const verifyIx = getVerifyInstruction({
    authority: nftUpdateAuthority,
    metadata: nft.metadata,
    collectionMint: collection.mint,
    collectionMetadata: collection.metadata,
    collectionMasterEdition: collection.masterEdition,
    verificationArgs: VerificationArgs.CollectionV1,
  });

  await pipe(
    await createDefaultTransaction(client, nftUpdateAuthority),
    (tx) => appendTransactionMessageInstruction(verifyIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Deposit NFT should succeed now
  depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint: nft.mint,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
});

test('deposit fails VOC verification when no collection is present', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  const collection = await generateKeyPairSignerWithSol(client);

  // Mint NFT w/o collection
  const { mint } = await createDefaultNft({
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

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
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
