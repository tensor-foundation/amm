import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultTransaction,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import test from 'ava';
import {
  fetchMaybeNftDepositReceipt,
  fetchMaybePool,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftT22InstructionAsync,
  Pool,
  PoolType,
} from '../../src';
import {
  BASIS_POINTS,
  findAtaPda,
  getTokenAmount,
  getTokenOwner,
  setupT22Test,
  TAKER_FEE_BPS,
  TestAction,
  tradePoolConfig,
} from '../_common';

test('it can buy a T22 NFT from a Trade pool', async (t) => {
  const { signers, nft, testConfig, pool, feeVault } = await setupT22Test({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Buy,
  });

  const { client, buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas, sellerFeeBasisPoints } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

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
      },
    },
  });

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance ===
      startingFeeVaultBalance +
        (tradePoolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // Deposit Receipt is closed
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (tradePoolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});

test.only('it can buy a T22 NFT from a NFT pool', async (t) => {
  const { signers, nft, testConfig, pool, feeVault } = await setupT22Test({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
  });

  const { client, buyer, poolOwner, nftUpdateAuthority } = signers;

  const { price: maxAmount } = testConfig;

  const { mint, extraAccountMetas, sellerFeeBasisPoints } = nft;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    mint,
    maxAmount,
    tokenProgram: TOKEN22_PROGRAM_ID,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  const [nftReceipt] = await findNftDepositReceiptPda({ mint, pool });

  // NFT is now owned by the buyer.
  const buyerAtaAccount = await client.rpc
    .getAccountInfo(buyerAta, { encoding: 'base64' })
    .send();

  const data = buyerAtaAccount!.value!.data;

  const postBuyTokenAmount = getTokenAmount(data);
  const postBuyTokenOwner = getTokenOwner(data);

  t.assert(postBuyTokenAmount === 1n);
  t.assert(postBuyTokenOwner === buyer.address);

  // Pool is closed because no more NFTs are available.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Fee vault balance increases by entire fee, since no taker or maker brokers passed in.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance ===
      startingFeeVaultBalance +
        (tradePoolConfig.startingPrice * TAKER_FEE_BPS) / BASIS_POINTS
  );

  // Deposit Receipt is closed
  const maybeNftReceipt = await fetchMaybeNftDepositReceipt(
    client.rpc,
    nftReceipt
  );
  t.assert(maybeNftReceipt.exists === false);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(nftUpdateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (tradePoolConfig.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});
