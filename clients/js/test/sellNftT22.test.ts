import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { fetchToken, Token } from '@solana-program/token';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultTransaction,
  createT22NftWithRoyalties,
  signAndSendTransaction,
  TOKEN22_PROGRAM_ID,
  TSWAP_PROGRAM_ID
} from '@tensor-foundation/test-helpers';
import { intoAddress, Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getSellNftTokenPoolT22InstructionAsync,
  getSellNftTradePoolT22InstructionAsync,
  isSol,
  NftDepositReceipt,
  Pool,
  PoolType,
} from '../src';
import {
  BASIS_POINTS,
  createPoolAndWhitelist,
  findAtaPda,
  getAndFundFeeVault,
  getSellNftSigners,
  getTokenAmount,
  getTokenOwner,
  TAKER_FEE_BPS,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof
} from './_common';
import { generateTreeOfSize } from './_merkle';

test('it can sell a T22 NFT into a Trade pool', async (t) => {
  const {
    client,
    updateAuthority,
    poolOwner,
    nftOwner,
    makerBroker,
    takerBroker,
  } = await getSellNftSigners();

  const config = tradePoolConfig;
  const depositAmount = config.startingPrice * 10n;
  const minPrice = 85_000_000n;

  const royaltyDestinationString = '_ro_' + updateAuthority.address;
  const sellerFeeBasisPoints = 500n;

  // Mint NFT
  const { mint, ownerAta, extraAccountMetas } = await createT22NftWithRoyalties(
    {
      client,
      payer: nftOwner,
      owner: nftOwner.address,
      mintAuthority: updateAuthority,
      freezeAuthority: null,
      decimals: 0,
      data: {
        name: 'Test Token',
        symbol: 'TT',
        uri: 'https://example.com',
      },
      royalties: {
        key: royaltyDestinationString,
        value: sellerFeeBasisPoints.toString(),
      },
    }
  );

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: nftOwner.address,
      amount: 1n,
    },
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
    depositAmount,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
    funded: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Trade);
  t.assert(poolAccount.data.config.mmFeeBps === 50);

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(updateAuthority.address).send()
  ).value;

  const [poolAta] = await findAtaPda({
    mint,
    owner: pool,
    tokenProgramId: TOKEN22_PROGRAM_ID,
  });

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer: nftOwner,
    mint,
    whitelist,
    proof: p.proof,
  });

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    sellerTa: ownerAta,
    pool,
    poolTa: poolAta,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [updateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

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

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 0,
        takerSellCount: 1,
      },
    },
  });

  // This is a Trade pool without a shared escrow, so funds come from the pool.

  // Because this is a trade pool sell, our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;

  // Fee vault balance increases by half the taker fee, since we also pay maker and taker broker.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance ===
      startingFeeVaultBalance + (price * (TAKER_FEE_BPS / 2n)) / BASIS_POINTS
  );

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = price;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(updateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (price * sellerFeeBasisPoints) / BASIS_POINTS
  );
});

test('it can sell a T22 NFT into a Token pool', async (t) => {
  const {
    client,
    updateAuthority,
    poolOwner,
    nftOwner,
    makerBroker,
    takerBroker,
  } = await getSellNftSigners();

  const config = tokenPoolConfig;
  const depositAmount = config.startingPrice * 10n;
  const minPrice = 85_000_000n;

  const royaltyDestinationString = '_ro_' + updateAuthority.address;
  const sellerFeeBasisPoints = 500n;

  // Mint NFT
  const { mint, ownerAta, extraAccountMetas } = await createT22NftWithRoyalties(
    {
      client,
      payer: nftOwner,
      owner: nftOwner.address,
      mintAuthority: updateAuthority,
      freezeAuthority: null,
      decimals: 0,
      data: {
        name: 'Test Token',
        symbol: 'TT',
        uri: 'https://example.com',
      },
      royalties: {
        key: royaltyDestinationString,
        value: sellerFeeBasisPoints.toString(),
      },
    }
  );

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: nftOwner.address,
      amount: 1n,
    },
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
    depositAmount,
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
    funded: true,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);
  t.assert(poolAccount.data.config.mmFeeBps === null);

  // Balance of pool before any sales operations, but including the SOL deposit.
  const prePoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  const startingUpdateAuthorityBalance = (
    await client.rpc.getBalance(updateAuthority.address).send()
  ).value;

  const [poolOwnerAta] = await findAtaPda({
    mint,
    owner: poolOwner.address,
    tokenProgramId: TOKEN22_PROGRAM_ID,
  });

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer: nftOwner,
    mint,
    whitelist,
    proof: p.proof,
  });

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolT22InstructionAsync({
    owner: poolOwner.address, // pool owner
    seller: nftOwner, // nft owner--the seller
    sellerTa: ownerAta,
    pool,
    whitelist,
    mint,
    mintProof,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [updateAuthority.address],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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

  const postPoolBalance = (await client.rpc.getBalance(pool).send()).value;

  // NFT is now owned by the pool owner.
  const poolOwnerAtaAccount = (
    await client.rpc.getAccountInfo(poolOwnerAta, { encoding: 'base64' }).send()
  ).value;

  const poolOwnerAtaData = poolOwnerAtaAccount!.data;

  const tokenAmount = getTokenAmount(poolOwnerAtaData);
  const tokenOwner = getTokenOwner(poolOwnerAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === poolOwner.address);

  // Pool stats are updated
  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      stats: {
        takerBuyCount: 0,
        takerSellCount: 1,
      },
    },
  });

  // This is a Token pool without a shared escrow, so funds come from the pool.
  // Token pools do not get the mmFee.
  t.assert(postPoolBalance === prePoolBalance - config.startingPrice);

  // Fee vault balance increases by half the taker fee, since we also pay maker and taker broker.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(
    endingFeeVaultBalance ===
      startingFeeVaultBalance +
        (config.startingPrice * (TAKER_FEE_BPS / 2n)) / BASIS_POINTS
  );

  // The pool pays out the current_price - mm_fees, if compounded.
  // In this case, no compounding, so the pool pays out the full price.
  const lamportsTaken = config.startingPrice;

  t.assert(postPoolBalance === prePoolBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Only one sell, so the currency amount should be the deposit - lamportsTaken for the sale.
  t.assert(updatedPoolAccount.data.amount === depositAmount - lamportsTaken);

  // Check that the royalties were paid correctly
  const endingUpdateAuthorityBalance = (
    await client.rpc.getBalance(updateAuthority.address).send()
  ).value;
  t.assert(
    endingUpdateAuthorityBalance ===
      startingUpdateAuthorityBalance +
        (config.startingPrice * sellerFeeBasisPoints) / BASIS_POINTS
  );
});
