import { fetchToken, Token } from '@solana-program/token';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22Nft,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { intoAddress, Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  fetchMaybeNftDepositReceipt,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftT22InstructionAsync,
  getDepositNftT22InstructionAsync,
  NftDepositReceipt,
  Pool,
  PoolType,
} from '../src';
import {
  createPool,
  createWhitelistV2,
  findAtaPda,
  getAndFundFeeVault,
  getTokenAmount,
  getTokenOwner,
  tradePoolConfig,
  upsertMintProof,
} from './_common';
import { generateTreeOfSize } from './_merkle';

test('it can buy a T22 NFT from a Trade pool', async (t) => {
  const client = createDefaultSolanaClient();

  // NFT Update Authority
  const updateAuthority = await generateKeyPairSignerWithSol(client);

  // Pool and NFT owner.
  const owner = await generateKeyPairSignerWithSol(client);
  // Buyer of the NFT.
  const buyer = await generateKeyPairSignerWithSol(client);

  // Mint NFT
  const [mint, ownerAta] = await createT22Nft({
    client,
    payer: updateAuthority,
    owner: owner.address,
    mintAuthority: updateAuthority,
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
  });

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: owner.address,
      amount: 1n,
    },
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

  const config = tradePoolConfig;
  const maxAmount = 1_100_000n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: owner,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
  });

  const { mintProof } = await upsertMintProof({
    client,
    payer: owner,
    mint,
    whitelist,
    proof: p.proof,
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
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  const depositNftIx = await getDepositNftT22InstructionAsync({
    owner,
    pool,
    whitelist,
    mint,
    mintProof,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, owner),
    (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [poolAta] = await findAtaPda({
    mint,
    owner: pool,
    tokenProgramId: TOKEN22_PROGRAM_ID,
  });

  // NFT is now owned by the pool.
  const poolAtaAccount = (
    await client.rpc.getAccountInfo(poolAta, { encoding: 'base64' }).send()
  ).value;

  const poolAtaData = poolAtaAccount!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // Deposit Receipt should be created
  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });
  t.like(await fetchNftDepositReceipt(client.rpc, nftReceipt), <
    Account<NftDepositReceipt, Address>
  >{
    address: nftReceipt,
    data: {
      mint,
      pool,
    },
  });

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // const startingUpdateAuthorityBalance = (
  //   await client.rpc.getBalance(updateAuthority.address).send()
  // ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: owner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    poolTa: poolAta,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [owner.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [buyerAta] = await findAtaPda({
    mint,
    owner: buyer.address,
    tokenProgramId: TOKEN22_PROGRAM_ID,
  });

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 1,
        takerSellCount: 0,
        //accumulatedMmProfit: ?
      },
    },
  });

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Deposit Receipt is closed
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);

  // Royalties paid to update authority--TODO re-enable once transfer hooks are supported in test-helpers
  // const endingUpdateAuthorityBalance = (
  //   await client.rpc.getBalance(updateAuthority.address).send()
  // ).value;
  // console.log(startingUpdateAuthorityBalance);
  // console.log(endingUpdateAuthorityBalance);
  // t.assert(updateAuthorityBalance > startingUpdateAuthorityBalance);
});
