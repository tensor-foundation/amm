import { appendTransactionMessageInstruction, pipe } from '@solana/web3.js';
import {
  findMarginAccountPda,
  getInitMarginAccountInstructionAsync,
  TENSOR_ESCROW_PROGRAM_ADDRESS,
} from '@tensor-foundation/escrow';
import { createDefaultAssetWithCollection } from '@tensor-foundation/mpl-core';
import { createDefaultNft } from '@tensor-foundation/mpl-token-metadata';
import {
  ANCHOR_ERROR__INVALID_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22NftWithRoyalties,
  generateKeyPairSignerWithSol,
  LAMPORTS_PER_SOL,
  signAndSendTransaction,
  TSWAP_SINGLETON,
} from '@tensor-foundation/test-helpers';
import test from 'ava';
import {
  CurveType,
  findPoolPda,
  getCreatePoolInstructionAsync,
  getSellNftTokenPoolCoreInstructionAsync,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTokenPoolT22InstructionAsync,
  getSellNftTradePoolCoreInstructionAsync,
  getSellNftTradePoolInstructionAsync,
  getSellNftTradePoolT22InstructionAsync,
  PoolType,
} from '../src';
import {
  createWhitelistV2,
  expectCustomError,
  generateUuid,
  initTswap,
  MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
} from './_common';

test("a custom program can't imitate being the amm program to drain the margin account in a malicious noop handler", async (t) => {
  const client = createDefaultSolanaClient();
  const marginAccountOwner = await generateKeyPairSignerWithSol(client);
  const attacker = await generateKeyPairSignerWithSol(client);
  const nftUpdateAuthority = await generateKeyPairSignerWithSol(client);
  await initTswap(client);

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: marginAccountOwner,
  });

  const [marginAccountPda] = await findMarginAccountPda({
    owner: marginAccountOwner.address,
    marginNr: 0,
    tswap: TSWAP_SINGLETON,
  });

  const createMarginAccountIx = await getInitMarginAccountInstructionAsync({
    marginAccount: marginAccountPda,
    owner: marginAccountOwner,
  });

  await pipe(
    await createDefaultTransaction(client, marginAccountOwner),
    (tx) => appendTransactionMessageInstruction(createMarginAccountIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const tradePoolId = generateUuid();
  const [tradePoolAta] = await findPoolPda({
    poolId: tradePoolId,
    owner: marginAccountOwner.address,
  });

  const createTradePoolIx = await getCreatePoolInstructionAsync({
    owner: marginAccountOwner,
    whitelist,
    pool: tradePoolAta,
    poolId: tradePoolId,
    config: {
      poolType: PoolType.Trade,
      startingPrice: LAMPORTS_PER_SOL / 2n,
      delta: 0,
      mmCompoundFees: false,
      mmFeeBps: null,
      curveType: CurveType.Linear,
    },
    sharedEscrow: marginAccountPda,
  });
  await pipe(
    await createDefaultTransaction(client, marginAccountOwner),
    (tx) => appendTransactionMessageInstruction(createTradePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const tokenPoolId = generateUuid();
  const [tokenPoolAta] = await findPoolPda({
    poolId: tokenPoolId,
    owner: marginAccountOwner.address,
  });

  const createTokenPoolIx = await getCreatePoolInstructionAsync({
    owner: marginAccountOwner,
    whitelist,
    pool: tokenPoolAta,
    poolId: tokenPoolId,
    config: {
      poolType: PoolType.Token,
      startingPrice: LAMPORTS_PER_SOL / 2n,
      delta: 0,
      mmCompoundFees: false,
      mmFeeBps: null,
      curveType: CurveType.Linear,
    },
    sharedEscrow: marginAccountPda,
  });
  await pipe(
    await createDefaultTransaction(client, marginAccountOwner),
    (tx) => appendTransactionMessageInstruction(createTokenPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Legacy:
  const { mint } = await createDefaultNft({
    client,
    owner: attacker.address,
    payer: attacker,
    authority: nftUpdateAuthority,
  });

  const sellTradePoolIx = await getSellNftTradePoolInstructionAsync({
    owner: marginAccountOwner.address,
    pool: tradePoolAta,
    mint,
    whitelist,
    minPrice: 0n,
    taker: attacker,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  const sellTradePoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTradePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, sellTradePoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);

  const sellTokenPoolIx = await getSellNftTokenPoolInstructionAsync({
    owner: marginAccountOwner.address,
    pool: tradePoolAta,
    mint,
    whitelist,
    minPrice: 0n,
    taker: attacker,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  const sellTokenPoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTokenPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, sellTokenPoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);

  // Core:
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer: attacker,
    collectionAuthority: nftUpdateAuthority,
    owner: attacker.address,
    royalties: {
      creators: [
        {
          percentage: 100,
          address: nftUpdateAuthority.address,
        },
      ],
      basisPoints: 0,
    },
  });

  const sellTokenPoolCoreIx = await getSellNftTokenPoolCoreInstructionAsync({
    whitelist,
    asset: asset.address,
    collection: collection?.address,
    owner: marginAccountOwner.address,
    taker: attacker,
    pool: tokenPoolAta,
    minPrice: 0n,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  const coreTokenPoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTokenPoolCoreIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, coreTokenPoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);

  const sellTradePoolCoreIx = await getSellNftTradePoolCoreInstructionAsync({
    whitelist,
    asset: asset.address,
    collection: collection?.address,
    owner: marginAccountOwner.address,
    taker: attacker,
    pool: tokenPoolAta,
    minPrice: 0n,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
  });

  const coreTradePoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTradePoolCoreIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, coreTradePoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);

  // T22:
  const t22Nft = await createT22NftWithRoyalties({
    client,
    payer: attacker,
    owner: attacker.address,
    mintAuthority: nftUpdateAuthority,
    freezeAuthority: null,
    decimals: 0,
    data: {
      name: 'Test Token',
      symbol: 'TT',
      uri: 'https://example.com',
    },
    royalties: {
      key: nftUpdateAuthority.address,
      value: '0',
    },
  });

  const sellTokenPoolT22Ix = await getSellNftTokenPoolT22InstructionAsync({
    owner: marginAccountOwner.address,
    pool: tokenPoolAta,
    mint: t22Nft.mint,
    whitelist,
    minPrice: 0n,
    taker: attacker,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: [],
  });

  const t22TokenPoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTokenPoolT22Ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, t22TokenPoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);

  const sellTradePoolT22Ix = await getSellNftTradePoolT22InstructionAsync({
    owner: marginAccountOwner.address,
    pool: tradePoolAta,
    mint: t22Nft.mint,
    whitelist,
    minPrice: 0n,
    taker: attacker,
    sharedEscrow: marginAccountPda,
    escrowProgram: TENSOR_ESCROW_PROGRAM_ADDRESS,
    // (!)
    ammProgram: MARGIN_WITHDRAW_CPI_PROGRAM_ADDRESS,
    creators: [nftUpdateAuthority.address],
    transferHookAccounts: [],
  });

  const t22TradePoolTx = pipe(
    await createDefaultTransaction(client, attacker),
    (tx) => appendTransactionMessageInstruction(sellTradePoolT22Ix, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, t22TradePoolTx, ANCHOR_ERROR__INVALID_PROGRAM_ID);
});
