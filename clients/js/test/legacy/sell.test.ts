import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
import {
  Account,
  Address,
  IInstruction,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  generateKeyPairSigner,
  isSome,
  pipe,
} from '@solana/web3.js';
import {
  Creator,
  TokenStandard,
  VerificationArgs,
  createDefaultNft,
  createDefaultNftInCollection,
  fetchMetadata,
  getUnverifyInstruction,
  getVerifyInstruction,
  printSupply,
} from '@tensor-foundation/mpl-token-metadata';
import {
  ANCHOR_ERROR__CONSTRAINT_SEEDS,
  ANCHOR_ERROR__CONSTRAINT_TOKEN_MINT,
  LAMPORTS_PER_SOL,
  ONE_SOL,
  TENSOR_ERROR__BAD_ROYALTIES_PCT,
  TENSOR_ERROR__INSUFFICIENT_BALANCE,
  TENSOR_VIPER_ERROR__INTEGER_OVERFLOW,
  TSWAP_PROGRAM_ID,
  assertTokenNftOwnedBy,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  getBalance,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  Mode,
  TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION,
  TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION,
  intoAddress,
} from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  Pool,
  PoolConfig,
  PoolType,
  TENSOR_AMM_ERROR__PRICE_MISMATCH,
  TENSOR_AMM_ERROR__WRONG_COSIGNER,
  TENSOR_AMM_ERROR__WRONG_MAKER_BROKER,
  TENSOR_AMM_ERROR__WRONG_POOL_TYPE,
  TENSOR_AMM_ERROR__WRONG_WHITELIST,
  fetchMaybePool,
  fetchPool,
  getCurrentBidPrice,
  getCurrentBidPriceSync,
  getDepositSolInstruction,
  getEditPoolInstruction,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
  isSol,
} from '../../src/index.js';
import {
  COMPUTE_500K_IX,
  COMPUTE_700K_IX,
  DEFAULT_DELTA,
  MAX_MM_FEES_BPS,
  TestAction,
  assertTammNoop,
  createAndFundEscrow,
  createPool,
  createPoolAndWhitelist,
  createWhitelistV2,
  expectCustomError,
  findAtaPda,
  getAndFundFeeVault,
  getTestSigners,
  getTokenAmount,
  getTokenOwner,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';
import { generateTreeOfSize } from '../_merkle.js';
import { COMPAT_RULESET, setupLegacyTest, testSell } from './_common.js';

test('sell NFT into Token pool', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });
});

test('sell NFT into Token pool, wrong owner fails', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  const wrongOwner = await generateKeyPairSigner();
  legacyTest.signers.poolOwner = wrongOwner;

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('sell NFT into Trade pool', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });
});

test('sell NFT into Trade pool, wrong owner fails', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  const wrongOwner = await generateKeyPairSigner();
  legacyTest.signers.poolOwner = wrongOwner;

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    expectError: ANCHOR_ERROR__CONSTRAINT_SEEDS,
  });
});

test('sell NFT into Trade pool, wrong edition fails', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      useCosigner: false,
      fundPool: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { mint } = nft;
  const { price: minPrice } = testConfig;

  const wrongEdition = await generateKeyPairSigner();

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    minPrice,
    edition: wrongEdition.address,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Edition fails on Anchor seeds check.
  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_SEEDS);
});

test('sell NFT into NFT pool fails', async (t) => {
  // Setup a NFT pool, with a NFT deposited.
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.NFT,
    action: TestAction.Buy,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  const { client, signers, nft, testConfig, pool, whitelist } = legacyTest;
  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Initialize taker token account to get past that constraint check.
  const [takerTa] = await findAtaPda({ mint, owner: nftOwner.address });
  const takerTaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer: nftOwner,
    ata: takerTa,
    owner: nftOwner.address,
    mint,
  });
  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(takerTaIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // The NFT receipt already exists, so creating it again fails.
  await expectCustomError(t, promise, 0);
});

test('sell NFT into Token pool, pay brokers', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: true,
    cosigner: false,
  });
});

test('sell NFT into Trade pool, pay brokers', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: true,
    cosigner: false,
  });
});

test('sell into token pool, pay optional royalties', async (t) => {
  t.timeout(60_000);
  for (const royaltyPct of [undefined, 0, 33, 50, 100]) {
    const legacyTest = await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
    });

    await testSell(t, legacyTest, {
      brokerPayments: false,
      cosigner: false,
      optionalRoyaltyPct: royaltyPct,
      checkCreatorBalances: true,
    });
  }
});

test('sell into trade pool, pay optional royalties', async (t) => {
  t.timeout(60_000);
  for (const royaltyPct of [undefined, 0, 33, 50, 100]) {
    const legacyTest = await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
    });

    await testSell(t, legacyTest, {
      brokerPayments: false,
      cosigner: false,
      optionalRoyaltyPct: royaltyPct,
      checkCreatorBalances: true,
    });
  }

  // Now do invalid royalty percent and expect it to fail with  BadRoyaltiesPct.
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: true,
    useSharedEscrow: false,
    fundPool: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: true,
    cosigner: false,
    optionalRoyaltyPct: 101,
    expectError: TENSOR_ERROR__BAD_ROYALTIES_PCT,
  });
});

test('sell pNFT into Token pool, pay low and high royalties', async (t) => {
  t.timeout(30_000);
  // Setup a Trade pool with funds.
  const client = createDefaultSolanaClient();
  const testSigners = await getTestSigners(client, 10n * ONE_SOL);

  const { payer, poolOwner, nftOwner, nftUpdateAuthority } = testSigners;

  const config = structuredClone(tokenPoolConfig);

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 9n * ONE_SOL,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const nftData = {
    name: 'Example NFT',
    symbol: 'EXNFT',
    uri: 'https://example.com/nft',
    sellerFeeBasisPoints: 0,
    creators: [
      {
        address: nftUpdateAuthority.address,
        verified: true,
        share: 100,
      },
    ],
    printSupply: printSupply('Zero'),
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  };

  // Sell NFTs into pool at various royalties basis points.
  for (const royaltyBps of [1, 50, 3000, 9000]) {
    // Mint NFT
    const nft = await createDefaultNft({
      client,
      payer,
      authority: nftUpdateAuthority,
      owner: nftOwner.address,
      data: { ...nftData, sellerFeeBasisPoints: royaltyBps },
      standard: TokenStandard.ProgrammableNonFungible,
      creators: [
        {
          address: nftUpdateAuthority.address,
          share: 100,
          verified: true,
        },
      ],
    });

    const poolAccount = await fetchPool(client.rpc, pool);

    const price = getCurrentBidPriceSync({
      pool: poolAccount.data,
      availableLamports: poolAccount.data.amount,
      royaltyFeeBps: royaltyBps,
      extraOffset: 0,
      excludeMMFee: true,
    });

    const creatorStartingBalance = await getBalance(
      client,
      nftUpdateAuthority.address
    );

    // Sell NFT into pool
    const sellNftIx = await getSellNftTokenPoolInstructionAsync({
      owner: poolOwner.address,
      taker: nftOwner,
      pool,
      mint: nft.mint,
      whitelist,
      minPrice: price!,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
      creators: [nftUpdateAuthority.address],
    });

    await pipe(
      await createDefaultTransaction(client, nftOwner),
      (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
      (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );

    const creatorEndingBalance = await getBalance(
      client,
      nftUpdateAuthority.address
    );

    t.assert(creatorEndingBalance > creatorStartingBalance);
  }
});

test('sell pNFT into Token pool, pay full royalties', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    optionalRoyaltyPct: 50, // this should be ignored because it's a pNFT
    checkCreatorBalances: true,
    pNft: true,
  });
});

test('sell pNFT into Token pool, no ruleset', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
  });
});

test('sell pNFT into Token pool, compat ruleset', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    ruleset: COMPAT_RULESET,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
    ruleset: COMPAT_RULESET,
  });
});

test('sell pNFT into Trade pool, no ruleset', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
  });
});

test('sell_nft_token_pool fails on trade pool', async (t) => {
  // Setup a Trade pool with funds.
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    ruleset: COMPAT_RULESET,
  });

  const { client, signers, nft, testConfig, pool, whitelist } = legacyTest;
  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Try to use the wrong instruction.
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    minPrice,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    authorizationRules: COMPAT_RULESET,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('sell_nft_trade_pool fails on token pool', async (t) => {
  // Setup a Token pool with funds.
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    ruleset: COMPAT_RULESET,
  });

  const { client, signers, nft, testConfig, pool, whitelist } = legacyTest;
  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Try to use the wrong instruction.
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    minPrice,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    authorizationRules: COMPAT_RULESET,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_POOL_TYPE);
});

test('sell into Token pool, min price lower than current price succeeds', async (t) => {
  // Our minimum price below the current price should succeed.
  t.timeout(15_000);
  for (const adjust of [99n, 50n, 1n]) {
    const legacyTest = await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
    });

    // We multiply by the pre-configured minPrice which includes the mm fee and royalties deductions.
    legacyTest.testConfig.price = (legacyTest.testConfig.price * adjust) / 100n;

    await testSell(t, legacyTest, {
      brokerPayments: false,
      cosigner: false,
    });
  }
});

test('sell into Token pool, min price higher than current price fails', async (t) => {
  t.timeout(15_000);
  for (const adjust of [101n, 10000n]) {
    const legacyTest = await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
    });

    // We multiply by the starting price which does not have mm fee and royalties added, so we can test the price mismatch logic.
    legacyTest.testConfig.price =
      (legacyTest.testConfig.poolConfig.startingPrice * adjust) / 100n;

    await testSell(t, legacyTest, {
      brokerPayments: false,
      cosigner: false,
      expectError: TENSOR_AMM_ERROR__PRICE_MISMATCH,
    });
  }
});

test('sell below 0 is not possible ', async (t) => {
  // sell nfts into the pool until the pool price would go negative
  const startingPrice = tradePoolConfig.startingPrice;
  const delta = tradePoolConfig.delta;

  // Deposit amount should be enough to pay for 2 nfts
  const depositAmount = 2n * startingPrice + delta;

  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    depositAmount,
    whitelistMode: Mode.FVC,
  });

  // Should succeed
  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
  });

  // Mint next nft
  const nft2 = await createDefaultNft({
    client: legacyTest.client,
    payer: legacyTest.signers.poolOwner,
    authority: legacyTest.signers.nftUpdateAuthority,
    owner: legacyTest.signers.nftOwner.address,
    standard: TokenStandard.NonFungible,
    creators: [
      {
        address: legacyTest.signers.nftUpdateAuthority.address,
        share: 100,
        verified: true,
      },
    ],
  });

  const poolAccount = await fetchPool(legacyTest.client.rpc, legacyTest.pool);
  const poolAmount = poolAccount.data.amount;

  // Get next price
  const currentPrice = BigInt(
    getCurrentBidPriceSync({
      pool: poolAccount.data,
      availableLamports: poolAmount,
      royaltyFeeBps: 100,
      extraOffset: 0,
      excludeMMFee: false,
    }) ?? 0n
  );

  // Should succeed
  let sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: legacyTest.signers.poolOwner.address, // pool owner
    taker: legacyTest.signers.nftOwner, // nft owner--the seller
    pool: legacyTest.pool,
    whitelist: legacyTest.whitelist, // override whitelist if passed in
    mint: nft2.mint,
    minPrice: currentPrice,
    // Remaining accounts
    creators: [legacyTest.signers.nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.nftOwner
    ),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  // Mint next nft
  const nft3 = await createDefaultNft({
    client: legacyTest.client,
    payer: legacyTest.signers.poolOwner,
    authority: legacyTest.signers.nftUpdateAuthority,
    owner: legacyTest.signers.nftOwner.address,
    standard: TokenStandard.NonFungible,
    creators: [
      {
        address: legacyTest.signers.nftUpdateAuthority.address,
        share: 100,
        verified: true,
      },
    ],
  });

  // Should fail
  sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: legacyTest.signers.poolOwner.address, // pool owner
    taker: legacyTest.signers.nftOwner, // nft owner--the seller
    pool: legacyTest.pool,
    whitelist: legacyTest.whitelist, // override whitelist if passed in
    mint: nft3.mint,
    minPrice: 0, // spoof min price to get past price mismatch check
    // Remaining accounts
    creators: [legacyTest.signers.nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.nftOwner
    ),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  await expectCustomError(t, promise, TENSOR_VIPER_ERROR__INTEGER_OVERFLOW);
});

test('sell into Token pool, skip non-rent-exempt creators', async (t) => {
  const client = createDefaultSolanaClient();

  // Fund the first 3 creators with 1 SOL so they're rent exempt.
  const creatorSigners = await Promise.all(
    Array.from({ length: 3 }, () => generateKeyPairSignerWithSol(client))
  );
  // Add two more creators to the end of the array that are not rent exempt.
  creatorSigners.push(
    ...(await Promise.all(
      Array.from({ length: 2 }, () => generateKeyPairSigner())
    ))
  );

  let creators: Creator[] = creatorSigners.map(({ address }) => ({
    address,
    verified: false, // have to set this to false so creating the NFT will work
    share: 20,
  }));

  // Set starting price low enough that the royalties don't push it above the rent exempt threshold.
  const config = structuredClone(tokenPoolConfig);
  config.startingPrice = 10000n;
  config.delta = config.startingPrice / 10n;

  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    creators,
    poolConfig: config,
    treeSize: 10_000,
    whitelistMode: Mode.MerkleTree,
    pNft: true,
  });

  const verifyCreatorIxs: IInstruction[] = [];

  for (const creator of creatorSigners ?? []) {
    verifyCreatorIxs.push(
      getVerifyInstruction({
        authority: creator,
        metadata: legacyTest.nft.metadata,
        verificationArgs: VerificationArgs.CreatorV1,
      })
    );
  }

  await pipe(
    await createDefaultTransaction(client, creatorSigners[0]),
    (tx) => appendTransactionMessageInstructions(verifyCreatorIxs, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Ensure creators are now verified.
  const md = await fetchMetadata(client.rpc, legacyTest.nft.metadata);

  if (isSome(md.data.creators)) {
    creators = md.data.creators.value;
  } else {
    creators = [];
  }

  t.assert(creators.every((c) => c.verified));

  const creatorStartingBalances = await Promise.all(
    creatorSigners.map((c) => getBalance(client, c.address))
  );

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    creators, // pass in the verified creators
    checkCreatorBalances: false,
    pNft: true,
  });

  // First three creators should have a higher balance.
  for (const [i, creator] of creatorSigners.slice(0, 3).entries()) {
    const balance = await getBalance(client, creator.address);
    t.assert(balance > creatorStartingBalances[i]);
  }

  // Last two creators should have 0 balance.
  for (const creator of creatorSigners.slice(-2)) {
    const balance = await getBalance(client, creator.address);
    t.assert(balance === 0n);
  }
});

test('it can sell an NFT into a Trade pool w/ an escrow account', async (t) => {
  const client = createDefaultSolanaClient();
  const { poolOwner, nftOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    await getTestSigners(client);

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 10n * DEFAULT_DELTA,
    delta: DEFAULT_DELTA,
    mmCompoundFees: false,
    mmFeeBps: 50,
  };

  const depositAmount = config.startingPrice * 10n;

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Create a shared escrow account.
  const sharedEscrow = await createAndFundEscrow(client, poolOwner, 1);

  // Starting balance of the shared escrow.
  const preSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow).send()
  ).value;

  // Create a whitelist and a funded pool.
  const { whitelist, pool, cosigner } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
    sharedEscrow,
    depositAmount,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
    funded: false, // cannot deposit to shared escrow pool
  });

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  await getAndFundFeeVault(client, pool);

  t.like(await fetchPool(client.rpc, pool), <Account<Pool, Address>>{
    address: pool,
    data: {
      sharedEscrow,
      config,
    },
  });

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    pool,
    whitelist,
    mint,
    sharedEscrow,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  const postSharedEscrowBalance = (
    await client.rpc.getBalance(sharedEscrow).send()
  ).value;

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const poolAtaData = poolAtaAccount!.value!.data;

  const tokenAmount = getTokenAmount(poolAtaData);
  const tokenOwner = getTokenOwner(poolAtaData);

  t.assert(tokenAmount === 1n);
  t.assert(tokenOwner === pool);

  // This is a linear Trade pool with a shared escrow, so funds come from the escrow.
  //
  // Because this is a sell our starting price is shifted down one delta.
  const price = config.startingPrice - config.delta;

  // Compounding is off so the shared escrow loses the full price.
  const lamportsTaken = price;

  t.assert(postSharedEscrowBalance === preSharedEscrowBalance - lamportsTaken);

  const updatedPoolAccount = await fetchPool(client.rpc, pool);

  // Ensure it's a SOL currency.
  t.assert(isSol(updatedPoolAccount.data.currency));

  // Shared escrow pools should have an amount of 0.
  t.assert(updatedPoolAccount.data.amount === 0n);
});

test('sell into shared escrow pool cannot eat into escrow account rent', async (t) => {
  // We want to deposit not quite enough sol to pay for the NFT so it tries to eat into the escrow account's rent.
  const depositAmount = tokenPoolConfig.startingPrice - 1_000_000n;

  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: true,
    fundPool: true,
    depositAmount,
    whitelistMode: Mode.FVC,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    checkCreatorBalances: false,
    useSharedEscrow: true,
    expectError: TENSOR_ERROR__INSUFFICIENT_BALANCE,
  });
});

test('token pool autocloses when currency amount drops below current price', async (t) => {
  const client = createDefaultSolanaClient();
  const {
    payer,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
  } = await getTestSigners(client);

  const config = tokenPoolConfig;
  const depositAmount =
    config.startingPrice + (config.startingPrice * 50n) / 100n; // 1.5x the starting price

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer, // Original rent payer
    whitelist,
    owner: poolOwner,
    makerBroker: makerBroker.address,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer, // test generic payer
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  const startingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  const poolBalance = (await client.rpc.getBalance(pool).send()).value;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address, // rent payer
    pool,
    whitelist,
    mint,
    makerBroker: makerBroker.address,
    takerBroker: takerBroker.address,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
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

  // The amount left in the pool should be less than the current price so the pool should be auto-closed.
  const maybePool = await fetchMaybePool(client.rpc, pool);
  t.assert(maybePool.exists === false);

  // Remaining funds should be returned to the pool owner.
  const endingPoolOwnerBalance = (
    await client.rpc.getBalance(poolOwner.address).send()
  ).value;
  t.assert(
    startingPoolOwnerBalance <=
      endingPoolOwnerBalance + (poolBalance - config.startingPrice)
  );
});

test('sellNftTokenPool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const config = tokenPoolConfig;
  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.

  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === PoolType.Token);

  // New pool so currency amount is 0.
  t.assert(poolAccount.data.amount === 0n);

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer: nftUpdateAuthority,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL

  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool

  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    escrowProgram: TSWAP_PROGRAM_ID,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(computeIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('sellNftTradePool emits self-cpi logging event', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const config = tradePoolConfig;
  const depositAmount = config.startingPrice * 10n;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool and whitelist
  const { pool, cosigner } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address, // pool owner
    taker: nftOwner, // nft owner--the seller
    rentPayer: payer.address,
    pool,
    whitelist,
    mint,
    cosigner,
    minPrice,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
    escrowProgram: TSWAP_PROGRAM_ID,
  });

  const computeIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  const sig = await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(computeIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await assertTammNoop(t, client, sig);
});

test('sell NFT for FVC whitelist succeeds', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.FVC,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
  });
});

test('sell NFT for VOC whitelist succeeds', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.VOC,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
  });
});

test('sell NFT for MerkleTree whitelist succeeds', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    treeSize: 8,
    whitelistMode: Mode.MerkleTree,
  });

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
  });
});

test('sell NFT for FVC whitelist fails when creator is unverified', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.FVC,
  });

  // Test automatically verifies the creator so we unverify here.
  const unverifyIx = getUnverifyInstruction({
    authority: legacyTest.signers.nftUpdateAuthority,
    metadata: legacyTest.nft.metadata,
    verificationArgs: VerificationArgs.CreatorV1,
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.nftUpdateAuthority
    ),
    (tx) => appendTransactionMessageInstruction(unverifyIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
    expectError: TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION,
  });
});

test('sell NFT for VOC whitelist fails when collection is unverified', async (t) => {
  const legacyTest = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.VOC,
  });

  // Test automatically verifies the collection so we unverify here.
  const unverifyIx = getUnverifyInstruction({
    authority: legacyTest.signers.nftUpdateAuthority,
    metadata: legacyTest.nft.metadata,
    collectionMint: legacyTest.collection.mint,
    collectionMetadata: legacyTest.collection.metadata,
    verificationArgs: VerificationArgs.CollectionV1,
  });

  await pipe(
    await createDefaultTransaction(
      legacyTest.client,
      legacyTest.signers.nftUpdateAuthority
    ),
    (tx) => appendTransactionMessageInstruction(unverifyIx, tx),
    (tx) => signAndSendTransaction(legacyTest.client, tx)
  );

  await testSell(t, legacyTest, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
    expectError: TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION,
  });
});

test('sell for non-whitelisted NFT fails', async (t) => {
  const {
    client,
    testConfig,
    signers,
    nft: wlNft,
    whitelist,
    pool,
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Token,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    useCosigner: false,
    fundPool: true,
    whitelistMode: Mode.VOC,
  });

  const { payer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;

  // Create a NFT that is not whitelisted, it will be the wrong collection.
  const { item: nft } = await createDefaultNftInCollection({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    standard: TokenStandard.NonFungible,
  });

  // Non-whitelisted NFT + matching ata
  let sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint: nft.mint,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(
    t,
    promise,
    TENSOR_WHITELIST_ERROR__FAILED_VOC_VERIFICATION
  );

  // Non-whitelisted NFT + wl NFT ata
  sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint: nft.mint,
    takerTa: wlNft.token,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_TOKEN_MINT);

  // WL NFT mint + non-matching ata
  sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint: wlNft.mint,
    takerTa: nft.token,
    minPrice,
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, ANCHOR_ERROR__CONSTRAINT_TOKEN_MINT);
});

test('fail to sell merkle proof whitelisted NFT into FVC pool', async (t) => {
  const {
    client,
    signers,
    pool: fvcPool,
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.FVC,
  });

  // Mint NFT
  const { item: mtNft } = await createDefaultNftInCollection({
    client,
    payer: signers.nftUpdateAuthority,
    authority: signers.nftUpdateAuthority,
    owner: signers.nftOwner.address,
    standard: TokenStandard.ProgrammableNonFungible,
    creators: [
      {
        address: signers.nftUpdateAuthority.address,
        share: 100,
        verified: true,
      },
    ],
    ruleSet: COMPAT_RULESET,
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mtNft.mint]);
  const conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];

  // Create a whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: signers.nftUpdateAuthority,
    conditions,
  });

  const { mintProof } = await upsertMintProof({
    client,
    payer: signers.nftUpdateAuthority,
    mint: mtNft.mint,
    whitelist,
    proof: p.proof,
  });

  // Try to sell our merkle tree whitelisted NFT into a FVC pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: signers.poolOwner.address,
    taker: signers.nftOwner,
    pool: fvcPool,
    whitelist,
    mint: mtNft.mint,
    mintProof,
    minPrice: 0n,
    creators: [signers.nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('fail to sell merkle proof whitelisted NFT into VOC pool', async (t) => {
  const {
    client,
    signers,
    pool: fvcPool,
  } = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.VOC,
  });

  // Mint NFT
  const { item: mtNft } = await createDefaultNftInCollection({
    client,
    payer: signers.nftUpdateAuthority,
    authority: signers.nftUpdateAuthority,
    owner: signers.nftOwner.address,
    standard: TokenStandard.ProgrammableNonFungible,
    creators: [
      {
        address: signers.nftUpdateAuthority.address,
        share: 100,
        verified: true,
      },
    ],
    ruleSet: COMPAT_RULESET,
  });

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mtNft.mint]);
  const conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];

  // Create a whitelist
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: signers.nftUpdateAuthority,
    conditions,
  });

  const { mintProof } = await upsertMintProof({
    client,
    payer: signers.nftUpdateAuthority,
    mint: mtNft.mint,
    whitelist,
    proof: p.proof,
  });

  // Try to sell our merkle tree whitelisted NFT into a VOC pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: signers.poolOwner.address,
    taker: signers.nftOwner,
    pool: fvcPool,
    whitelist,
    mint: mtNft.mint,
    mintProof,
    minPrice: 0n,
    creators: [signers.nftUpdateAuthority.address],
  });

  const promise = pipe(
    await createDefaultTransaction(client, signers.nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('sell NFT w/ valid whitelist for pool A fails on pool B and vice versa', async (t) => {
  const legacyTestA = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.VOC,
  });
  const whitelistA = legacyTestA.whitelist;

  const legacyTestB = await setupLegacyTest({
    t,
    poolType: PoolType.Trade,
    action: TestAction.Sell,
    useMakerBroker: false,
    useSharedEscrow: false,
    fundPool: true,
    pNft: true,
    whitelistMode: Mode.FVC,
  });
  const whitelistB = legacyTestB.whitelist;

  await testSell(t, legacyTestA, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
    whitelist: whitelistB,
    expectError: TENSOR_AMM_ERROR__WRONG_WHITELIST,
  });

  await testSell(t, legacyTestB, {
    brokerPayments: false,
    cosigner: false,
    pNft: true,
    whitelist: whitelistA,
    expectError: TENSOR_AMM_ERROR__WRONG_WHITELIST,
  });
});

test('it can sell an NFT into a trade pool w/ set cosigner', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority, cosigner } =
    await getTestSigners(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
    cosigner,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: whitelist,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address],
    cosigner: cosigner,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  const [poolAta] = await findAtaPda({ mint, owner: pool });
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const data = poolAtaAccount!.value!.data;

  const postSellTokenAmount = getTokenAmount(data);
  const postSellTokenOwner = getTokenOwner(data);

  t.assert(postSellTokenAmount === 1n);
  t.assert(postSellTokenOwner === pool);
});

test('it cannot sell an NFT into a trade pool w/ incorrect cosigner', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority, cosigner } =
    await getTestSigners(client);

  // Incorrect Cosigner
  const arbitraryCosigner = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create pool w/ cosigner
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
    cosigner: cosigner,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool without specififying cosigner
  const sellNftIxNoCosigner = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist,
    minPrice: minPrice,
    creators: [nftUpdateAuthority.address],
  });

  const promiseNoCosigner = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxNoCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseNoCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );

  // Sell NFT into pool with arbitraryCosigner
  const sellNftIxIncorrectCosigner = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist,
    minPrice,
    creators: [nftUpdateAuthority.address],
    cosigner: arbitraryCosigner,
  });

  const promiseIncorrectCosigner = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxIncorrectCosigner, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promiseIncorrectCosigner,
    TENSOR_AMM_ERROR__WRONG_COSIGNER
  );
});

test('it cannot sell an NFT into a token pool w/ incorrect whitelist', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  // Mint Whitelist Authority
  const mintWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  const config = tokenPoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist: poolWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: mintWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: mintWhitelistAuthority,
    conditions: [{ mode: Mode.FVC, value: mintWhitelistAuthority.address }],
  });

  // Create pool w/ poolWhitelist as whitelist
  const { pool } = await createPool({
    client,
    whitelist: poolWhitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: mintWhitelistAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool w/ specifying pool's whitelist & non-matching mint
  const sellNftIxPoolWL = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: poolWhitelist,
    minPrice: minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promisePoolWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxPoolWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promisePoolWL,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Sell NFT into pool w/ specifying mint's whitelist & non-matching pool
  const sellNftIxMintWL = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: mintWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it cannot sell an NFT into a trade pool w/ incorrect whitelist', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  // Mint Whitelist Authority
  const mintWhitelistAuthority = await generateKeyPairSignerWithSol(client);

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT update authority is the FVC.
  const { whitelist: poolWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftUpdateAuthority.address }],
  });

  // Create whitelist with FVC where the mintWhitelistAuthority is the FVC
  const { whitelist: mintWhitelist } = await createWhitelistV2({
    client,
    updateAuthority: mintWhitelistAuthority,
    conditions: [{ mode: Mode.FVC, value: mintWhitelistAuthority.address }],
  });

  // Create pool w/ poolWhitelist as whitelist
  const { pool } = await createPool({
    client,
    whitelist: poolWhitelist,
    owner: poolOwner,
    config,
  });

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint NFT
  const { mint } = await createDefaultNft({
    client,
    payer,
    authority: mintWhitelistAuthority,
    owner: nftOwner.address,
  });

  await getAndFundFeeVault(client, pool);

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  // Sell NFT into pool w/ specifying pool's whitelist & non-matching mint
  const sellNftIxPoolWL = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: poolWhitelist,
    minPrice: minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promisePoolWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxPoolWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(
    t,
    promisePoolWL,
    TENSOR_WHITELIST_ERROR__FAILED_FVC_VERIFICATION
  );

  // Sell NFT into pool w/ specifying mint's whitelist & non-matching pool
  const sellNftIxMintWL = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    whitelist: mintWhitelist,
    minPrice,
    creators: [mintWhitelistAuthority.address],
  });

  const promiseMintWL = pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIxMintWL, tx),
    (tx) => signAndSendTransaction(client, tx)
  );
  await expectCustomError(t, promiseMintWL, TENSOR_AMM_ERROR__WRONG_WHITELIST);
});

test('it can sell a pNFT into a trade pool and pay the correct amount of royalties', async (t) => {
  const client = createDefaultSolanaClient();
  const { payer, poolOwner, nftOwner, nftUpdateAuthority } =
    await getTestSigners(client);

  const creator = {
    address: nftUpdateAuthority.address,
    verified: true,
    share: 100,
  } as Creator;

  const config = tradePoolConfig;

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: nftUpdateAuthority,
    conditions: [{ mode: Mode.FVC, value: creator.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    payer,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Deposit sol into pool
  const depositIx = getDepositSolInstruction({
    pool,
    owner: poolOwner,
    lamports: 500_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionMessageInstruction(depositIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Mint a ProgrammableNonFungible.
  const { mint, metadata } = await createDefaultNft({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    standard: TokenStandard.ProgrammableNonFungible,
    creators: [creator],
  });

  // 0.8x the starting price
  const minPrice = (config.startingPrice * 8n) / 10n;

  const poolAccount = await fetchPool(client.rpc, pool);

  t.assert(poolAccount.data.config.poolType === PoolType.Trade);

  const { sellerFeeBasisPoints } = (await fetchMetadata(client.rpc, metadata))
    .data;

  const feeVault = await getAndFundFeeVault(client, pool);

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  const startingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  const exactBidPrice = await getCurrentBidPrice({
    rpc: client.rpc,
    pool: poolAccount.data,
    royaltyFeeBps: 0,
    excludeMMFee: true,
  });

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    rentPayer: payer.address,
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    // Remaining accounts
    creators: [creator.address],
  });

  // Use higher CU limit, pNFTs expensive
  const cuLimitIx = getSetComputeUnitLimitInstruction({
    units: 400_000,
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(cuLimitIx, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const [poolAta] = await findAtaPda({ mint, owner: pool });

  // NFT is now owned by the pool.
  const poolAtaAccount = await client.rpc
    .getAccountInfo(poolAta, { encoding: 'base64' })
    .send();

  const data = poolAtaAccount!.value!.data;

  const postSellTokenAmount = getTokenAmount(data);
  const postSellTokenOwner = getTokenOwner(data);

  t.assert(postSellTokenAmount === 1n);
  t.assert(postSellTokenOwner === pool);

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Creator receives exactly the sellerFeeBasisPoints specified in pNFTs metadata of the buy price
  // postBalance === preBalance + bidPrice * sellerFeeBasisPoints / 100_00
  const endingCreatorBalance = (
    await client.rpc.getBalance(creator.address).send()
  ).value;

  t.assert(
    endingCreatorBalance ===
      startingCreatorBalance +
        (BigInt(sellerFeeBasisPoints) * BigInt(exactBidPrice!)) / 100_00n
  );
});

test('pool owner cannot perform a sandwich attack on a seller on a Trade pool', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useMakerBroker: false,
      useSharedEscrow: false,
      fundPool: true,
      pNft: true,
    });

  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mint,
    minPrice, // exact price + mm_fees + royalties
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  // Pool owner edits the pool to update the mmFee to the maximum value.
  let newConfig = { ...tradePoolConfig, mmFeeBps: MAX_MM_FEES_BPS };

  let editPoolIx = getEditPoolInstruction({
    owner: poolOwner,
    pool,
    newConfig,
    resetPriceOffset: false,
  });

  // Pool owner edits the pool right before the sell instruction is executed.
  // Actual sandwich attack would be separate transactions, but this demonstrates the point as it's
  // a more generous assumption in favor of the attacker.
  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstructions([editPoolIx, sellNftIx], tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a price mismatch error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__PRICE_MISMATCH);

  // Pool owner should not be able to increase the mmFee value at all when an exact price is being passed in by the buyer,
  // which is the case in this test.
  const newMmFeeBps = tradePoolConfig.mmFeeBps! + 1;
  newConfig = { ...tradePoolConfig, mmFeeBps: newMmFeeBps };

  editPoolIx = getEditPoolInstruction({
    owner: poolOwner,
    pool,
    newConfig,
    resetPriceOffset: false,
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstructions([editPoolIx, sellNftIx], tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should still fail with a price mismatch error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__PRICE_MISMATCH);
});

test('trade pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: true, // MakerBroker is set
      fundPool: true,
    });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  let sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('it can sell a NFT into a token pool w/ Merkle root whitelist', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      whitelistMode: Mode.MerkleTree,
      useSharedEscrow: false,
      fundPool: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    mint,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool owner.
  await assertTokenNftOwnedBy({ t, client, mint, owner: poolOwner.address });
});

test('it can sell a NFT into a trade pool w/ Merkle root whitelist', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist, mintProof } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Sell,
      whitelistMode: Mode.MerkleTree,
      useSharedEscrow: false,
      fundPool: true,
    });

  const { poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  // Sell NFT into pool
  const sellNftIx = await getSellNftTradePoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    whitelist,
    mintProof,
    mint,
    minPrice, // exact price + mm_fees + royalties
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, nftOwner),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the pool.
  await assertTokenNftOwnedBy({ t, client, mint, owner: pool });
});

test('token pool with makerBroker set requires passing the account in & fails w/ incorrect makerBroker', async (t) => {
  const { client, signers, nft, testConfig, pool, whitelist } =
    await setupLegacyTest({
      t,
      poolType: PoolType.Token,
      action: TestAction.Sell,
      useSharedEscrow: false,
      useMakerBroker: true, // MakerBroker is set
      fundPool: true,
    });

  const fakeMakerBroker = await generateKeyPairSigner();
  const { buyer, poolOwner, nftOwner, nftUpdateAuthority } = signers;
  const { price: minPrice } = testConfig;
  const { mint } = nft;

  let sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    // No maker broker passed in
    creators: [nftUpdateAuthority.address],
  });

  let promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);

  sellNftIx = await getSellNftTokenPoolInstructionAsync({
    owner: poolOwner.address,
    taker: nftOwner,
    pool,
    mint,
    minPrice,
    whitelist,
    makerBroker: fakeMakerBroker.address, // Fake maker broker!
    creators: [nftUpdateAuthority.address],
  });

  promise = pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Should fail with a missing makerBroker error.
  await expectCustomError(t, promise, TENSOR_AMM_ERROR__WRONG_MAKER_BROKER);
});

test('alternate deposits & sells', async (t) => {
  t.timeout(25_000);
  const client = createDefaultSolanaClient();
  const numSells = 10;

  for (const poolType of [PoolType.Token, PoolType.Trade]) {
    for (const curveType of [CurveType.Linear, CurveType.Exponential]) {
      const traderA = await generateKeyPairSignerWithSol(
        client,
        100n * LAMPORTS_PER_SOL
      );
      const traderB = await generateKeyPairSignerWithSol(
        client,
        100n * LAMPORTS_PER_SOL
      );

      const config = {
        poolType,
        curveType,
        startingPrice: 1_238_923_843n,
        delta:
          curveType === CurveType.Linear
            ? 1_238_923_843n / BigInt(numSells)
            : 1021n,
        mmCompoundFees: true,
        mmFeeBps: poolType === PoolType.Trade ? 0 : null,
      };

      t.log('minting nfts');

      // Prepare multiple NFTs
      const nfts = await Promise.all(
        Array(numSells)
          .fill(null)
          .map(async () => {
            const { mint, metadata } = await createDefaultNft({
              client,
              payer: traderB,
              authority: traderB,
              owner: traderB.address,
            });
            const [ataA] = await findAtaPda({ mint, owner: traderA.address });
            const [ataB] = await findAtaPda({ mint, owner: traderB.address });
            return { mint, metadata, ataA, ataB };
          })
      );

      const { sellerFeeBasisPoints } = (
        await fetchMetadata(client.rpc, nfts[0].metadata)
      ).data;

      t.log('creating whitelist and pool');

      // Prepare whitelist and pool
      const { whitelist } = await createWhitelistV2({
        client,
        updateAuthority: traderA,
        conditions: [{ mode: Mode.FVC, value: traderB.address }],
      });

      const { pool } = await createPool({
        client,
        whitelist,
        owner: traderA,
        config,
      });

      t.log('depositing SOL');

      // Deposit SOL to the pool
      const depositAmount = config.startingPrice * BigInt(numSells) * 2n;
      const depositSolIx = getDepositSolInstruction({
        pool,
        owner: traderA,
        lamports: depositAmount,
      });

      await pipe(
        await createDefaultTransaction(client, traderA),
        (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      // Sell NFTs sequentially
      let sellCount = 0;

      let poolData = await fetchPool(client.rpc, pool);

      // Alternate between deposits and sells
      for (let i = 0; i < numSells; i++) {
        if (i % 2 === 0 || i === numSells - 1) {
          t.log('selling nft');

          // Sell NFT
          const nftToSell = nfts[sellCount];
          poolData = await fetchPool(client.rpc, pool);
          const currPrice = getCurrentBidPriceSync({
            pool: poolData.data,
            availableLamports: poolData.data.amount,
            royaltyFeeBps: sellerFeeBasisPoints,
            extraOffset: 0,
            excludeMMFee: poolType === PoolType.Token ? true : false,
          });

          let sellNftIx: IInstruction;

          if (poolType === PoolType.Token) {
            sellNftIx = await getSellNftTokenPoolInstructionAsync({
              owner: traderA.address,
              taker: traderB,
              pool,
              whitelist,
              mint: nftToSell.mint,
              minPrice: currPrice ?? 0n,
              creators: [traderB.address],
            });
          } else {
            sellNftIx = await getSellNftTradePoolInstructionAsync({
              owner: traderA.address,
              taker: traderB,
              pool,
              whitelist,
              mint: nftToSell.mint,
              minPrice: currPrice ?? 0n,
              creators: [traderB.address],
            });
          }

          await pipe(
            await createDefaultTransaction(client, traderB),
            (tx) => appendTransactionMessageInstruction(COMPUTE_700K_IX, tx),
            (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
            (tx) => signAndSendTransaction(client, tx)
          );
          sellCount++;
        } else {
          t.log('depositing SOL');

          // Deposit more SOL
          const additionalDeposit = config.startingPrice * 2n;
          const depositMoreSolIx = getDepositSolInstruction({
            pool,
            owner: traderA,
            lamports: additionalDeposit,
          });
          await pipe(
            await createDefaultTransaction(client, traderA),
            (tx) => appendTransactionMessageInstruction(depositMoreSolIx, tx),
            (tx) => signAndSendTransaction(client, tx)
          );
        }
      }

      // Check NFTs have been transferred correctly
      for (let i = 0; i < sellCount; i++) {
        await assertTokenNftOwnedBy({
          t,
          client,
          mint: nfts[i].mint,
          owner: poolType === PoolType.Token ? traderA.address : pool,
        });
      }

      // Check remaining NFTs are still with traderB
      for (let i = sellCount; i < numSells; i++) {
        await assertTokenNftOwnedBy({
          t,
          client,
          mint: nfts[i].mint,
          owner: traderB.address,
        });
      }

      // Check SOL balance in the pool
      poolData = await fetchPool(client.rpc, pool);
      t.assert(poolData.data.amount > 0n);
    }
  }
});

test('sell a ton with default exponential curve + tolerance', async (t) => {
  t.timeout(120_000); // Increase timeout due to many operations

  const client = createDefaultSolanaClient();
  const numSells = 47; // prime #

  const traderA = await generateKeyPairSignerWithSol(
    client,
    100_000n * LAMPORTS_PER_SOL
  );
  const traderB = await generateKeyPairSignerWithSol(
    client,
    100_000n * LAMPORTS_PER_SOL
  );

  const config = {
    poolType: PoolType.Token,
    curveType: CurveType.Exponential,
    startingPrice: 2_083_195_757n, // ~2 SOL (prime #)
    delta: 877n, // 8.77% (prime #)
    mmCompoundFees: true,
    mmFeeBps: null,
  };

  t.log('minting nfts');

  // Prepare multiple NFTs
  const nfts = await Promise.all(
    Array(numSells)
      .fill(null)
      .map(async () => {
        const { mint, metadata } = await createDefaultNft({
          client,
          payer: traderB,
          authority: traderB,
          owner: traderB.address,
        });
        const [ataA] = await findAtaPda({ mint, owner: traderA.address });
        const [ataB] = await findAtaPda({ mint, owner: traderB.address });
        return { mint, metadata, ataA, ataB };
      })
  );

  t.log('creating whitelist and pool');

  // Prepare whitelist and pool
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: traderA,
    conditions: [{ mode: Mode.FVC, value: traderB.address }],
  });

  const { pool } = await createPool({
    client,
    whitelist,
    owner: traderA,
    config,
  });

  t.log('depositing SOL');

  // Deposit SOL to the pool
  const depositAmount = config.startingPrice * BigInt(numSells) * 2n; // Deposit enough for all sells
  const depositSolIx = getDepositSolInstruction({
    pool,
    owner: traderA,
    lamports: depositAmount,
  });

  await pipe(
    await createDefaultTransaction(client, traderA),
    (tx) => appendTransactionMessageInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  t.log('selling nfts');

  // Sell NFTs sequentially
  for (const [sellCount, nft] of nfts.entries()) {
    const poolData = await fetchPool(client.rpc, pool);
    const currPrice = getCurrentBidPriceSync({
      pool: poolData.data,
      availableLamports: poolData.data.amount,
      royaltyFeeBps: 0, // Assuming no royalties for simplicity
      extraOffset: 0,
      excludeMMFee: true,
    });

    t.log(`selling nft ${sellCount + 1} at price ${currPrice}`);

    const sellNftIx = await getSellNftTokenPoolInstructionAsync({
      owner: traderA.address,
      taker: traderB,
      pool,
      whitelist,
      mint: nft.mint,
      minPrice: currPrice ?? 0n,
      creators: [traderB.address],
    });

    await pipe(
      await createDefaultTransaction(client, traderB),
      (tx) => appendTransactionMessageInstruction(COMPUTE_500K_IX, tx),
      (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );
  }

  t.log('verifying nft ownership');

  // Check NFTs have been transferred correctly
  for (const nft of nfts) {
    await assertTokenNftOwnedBy({
      t,
      client,
      mint: nft.mint,
      owner: traderA.address,
    });
  }
});
