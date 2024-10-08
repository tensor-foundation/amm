import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import { createDefaultNft } from '@tensor-foundation/mpl-token-metadata';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositNftInstructionAsync,
  NftDepositReceipt,
  PoolConfig,
  PoolType,
} from '../../src/index.js';
import {
  createPool,
  createWhitelistV2,
  findAtaPda,
  getTokenAmount,
  getTokenOwner,
  TestAction,
} from '../_common.js';
import { setupLegacyTest } from './_common.js';

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

test('it can buy an NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);

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

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  // Deposit NFT
  const depositNftIx = await getDepositNftInstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    nftReceipt,
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
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

  // Deposit Receipt created.
  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    Account<NftDepositReceipt, Address>
  >{
    address: nftReceipt,
    data: {
      mint,
      pool,
    },
  });
});
