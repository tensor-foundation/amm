import test from 'ava';
import {} from '@solana/programs';
import {
  appendTransactionInstruction,
  none,
  pipe,
  some,
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
  PoolConfig,
  getDepositNftInstruction,
  fetchNftDepositReceipt,
  NftDepositReceipt,
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

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);

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
  const { mint, metadata, masterEdition, token } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  const ownerAta = token;
  const [poolAta] = await findAtaPda({ mint, owner: pool });

  const [ownerTokenRecord] = await findTokenRecordPda({
    mint,
    token: ownerAta,
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
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositNftIx, tx),
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

  // Deposit Receipt created.
  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    NftDepositReceipt
  >{
    address: nftReceipt,
    data: {
      mint,
      pool,
    },
  });
});
