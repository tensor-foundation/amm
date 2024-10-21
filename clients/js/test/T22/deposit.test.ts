import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22NftWithRoyalties,
  expectCustomError,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  fetchWhitelistV2,
  getUpdateWhitelistV2Instruction,
  intoAddress,
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
  getDepositNftT22InstructionAsync,
  PoolConfig,
  PoolType,
} from '../../src/index.js';
import {
  COMPUTE_500K_IX,
  createPool,
  createWhitelistV2,
  errorLogsContain,
  TestAction,
  upsertMintProof,
} from '../_common.js';
import { generateTreeOfSize } from '../_merkle.js';
import { setupT22Test } from './_common.js';

test('it can deposit a NFT into a Trade pool w/ Merkle Tree mode', async (t) => {
  await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('it can deposit a NFT into a NFT pool w/ Merkle Tree mode', async (t) => {
  await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    fundPool: false,
    whitelistMode: Mode.MerkleTree,
  });
});

test('not passing in transfer hook accounts fails', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool, whitelist and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);

  const sellerFeeBasisPoints = 500n;

  // Mint NFT
  const { mint, extraAccountMetas } = await createT22NftWithRoyalties({
    client,
    payer: owner,
    owner: owner.address,
    mintAuthority: owner,
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
    royalties: {
      key: '_ro_' + owner.address,
      value: sellerFeeBasisPoints.toString(),
    },
  });

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

  const merkleTreeConditions = [
    { mode: Mode.MerkleTree, value: intoAddress(root) },
  ];

  // Create whitelist with FVC
  // use a separate keypair so NFT isn't part of this whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: merkleTreeConditions,
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner,
    config,
  });

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer: owner,
    mint,
    whitelist,
    proof: p.proof,
  });

  // Deposit NFT, missing transfer hook accounts
  let depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    mintProof,
    transferHookAccounts: [],
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await errorLogsContain(
    t,
    promise,
    'An account required by the instruction is missing'
  );

  // Succeeds.
  depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    mintProof,
    transferHookAccounts: extraAccountMetas.map((m) => m.address),
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
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
  // Mint NFT
  const { mint, extraAccountMetas } = await createT22NftWithRoyalties({
    client,
    payer: owner,
    owner: owner.address,
    mintAuthority: owner,
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
    royalties: {
      key: '_ro_' + owner.address,
      value: 500n.toString(),
    },
  });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  // Deposit NFT
  let depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    nftReceipt,
    transferHookAccounts: extraAccountMetas.map((m) => m.address),
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
  depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    nftReceipt,
    transferHookAccounts: extraAccountMetas.map((m) => m.address),
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
  depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    nftReceipt,
    transferHookAccounts: extraAccountMetas.map((m) => m.address),
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
