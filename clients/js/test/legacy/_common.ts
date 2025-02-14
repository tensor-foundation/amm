import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { fetchToken, Token } from '@solana-program/token';
import {
  Account,
  address,
  Address,
  appendTransactionMessageInstruction,
  IInstruction,
  KeyPairSigner,
  pipe,
} from '@solana/web3.js';
import {
  createDefaultNftInCollection,
  Creator,
  fetchMetadata,
  Nft,
  NftData,
  TokenStandard,
} from '@tensor-foundation/mpl-token-metadata';
import {
  Client,
  createDefaultSolanaClient,
  createDefaultTransaction,
  getBalance,
  ONE_SOL,
  signAndSendTransaction,
  TSWAP_PROGRAM_ID,
} from '@tensor-foundation/test-helpers';
import { Condition, intoAddress, Mode } from '@tensor-foundation/whitelist';
import { ExecutionContext } from 'ava';
import {
  fetchMaybePool,
  fetchPool,
  getBuyNftInstructionAsync,
  getCurrentAskPrice,
  getCurrentBidPriceSync,
  getDepositNftInstructionAsync,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync,
  Pool,
  PoolConfig,
  PoolType,
} from '../../src/index.js';
import {
  assertNftReceiptClosed,
  assertNftReceiptCreated,
  assertTokenNftOwnedBy,
  BASIS_POINTS,
  BROKER_FEE_PCT,
  COMPUTE_700K_IX,
  createAndFundEscrow,
  createPoolAndWhitelist,
  expectCustomError,
  getAndFundFeeVault,
  getTestSigners,
  HUNDRED_PERCENT,
  MAKER_BROKER_FEE_PCT,
  nftPoolConfig,
  SetupTestParams,
  TAKER_FEE_BPS,
  TestAction,
  TestConfig,
  TestSigners,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';
import { generateTreeOfSize } from '../_merkle.js';

export const COMPAT_RULESET = address(
  'AdH2Utn6Fus15ZhtenW4hZBQnvtLgM1YCW2MfVp7pYS5'
);

export interface LegacyTest {
  client: Client;
  signers: TestSigners;
  nft: Nft;
  collection: Nft;
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  sharedEscrow: Address | undefined;
  mintProof?: Address;
}

export async function setupLegacyTest(
  params: SetupTestParams & {
    creators?: Creator[] & { signers?: KeyPairSigner[] };
    sellerFeeBasisPoints?: number;
    pNft?: boolean;
    ruleset?: Address;
    signerFunds?: bigint;
    poolConfig?: PoolConfig | null;
    nftData?: NftData;
  }
): Promise<LegacyTest> {
  const {
    t,
    poolType,
    action,
    whitelistMode = Mode.FVC,
    depositAmount: dA,
    treeSize = 10,
    pNft = false,
    ruleset,
    useMakerBroker = false,
    useSharedEscrow = false,
    useCosigner = false,
    compoundFees = false,
    fundPool = true,
    poolConfig,
    signerFunds = 5n * ONE_SOL,
  } = params;

  const client = createDefaultSolanaClient();
  const testSigners = await getTestSigners(client, signerFunds);

  const { payer, poolOwner, nftUpdateAuthority, cosigner, makerBroker } =
    testSigners;

  let { nftOwner } = testSigners;

  // When buying, we mint the NFT to the poolOwner which then deposits it into the
  // pool so it can be purchased by the buyer.
  if (action == TestAction.Buy) {
    nftOwner = poolOwner;
  }

  // Mint NFT
  const { collection, item: nft } = await createDefaultNftInCollection({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner.address,
    standard: pNft
      ? TokenStandard.ProgrammableNonFungible
      : TokenStandard.NonFungible,
    creators: params.creators ?? [
      {
        address: nftUpdateAuthority.address,
        share: 100,
        verified: true,
      },
    ],
    ruleSet: ruleset,
  });

  const { mint, token: ownerAta } = nft;

  let config: PoolConfig;
  let price: bigint;
  let mmFees = 0n;

  let startingPrice;

  if (!poolConfig) {
    switch (poolType) {
      case PoolType.Trade:
        config = { ...tradePoolConfig, mmCompoundFees: compoundFees };
        // Sells on trade pools need to to have the price shifted down by 1 step.
        if (action === TestAction.Sell) {
          startingPrice = config.startingPrice - config.delta;
        } else {
          startingPrice = config.startingPrice;
        }
        mmFees = (startingPrice * BigInt(config.mmFeeBps ?? 0)) / BASIS_POINTS;
        break;
      case PoolType.Token:
        config = tokenPoolConfig;
        startingPrice = config.startingPrice;
        break;
      case PoolType.NFT:
        config = nftPoolConfig;
        startingPrice = config.startingPrice;
        break;
      default:
        throw new Error('Invalid pool type');
    }
  } else {
    config = poolConfig;
    startingPrice = poolConfig.startingPrice;
  }

  const md = (await fetchMetadata(client.rpc, nft.metadata)).data;
  const { sellerFeeBasisPoints } = md;

  const royalties =
    (startingPrice * BigInt(sellerFeeBasisPoints)) / BASIS_POINTS;

  const depositAmount = dA ?? ONE_SOL;

  // Check the token account has correct mint, amount and owner.
  t.like(await fetchToken(client.rpc, ownerAta), <Account<Token>>{
    address: ownerAta,
    data: {
      mint,
      owner: nftOwner.address,
      amount: 1n,
    },
  });

  let sharedEscrow: Address | undefined;

  if (useSharedEscrow) {
    // Create a shared escrow account.
    sharedEscrow = await createAndFundEscrow(
      client,
      poolOwner,
      1,
      depositAmount
    );
  }

  let conditions: Condition[] = [];
  let mintProof: Address | undefined;
  let proof;

  switch (whitelistMode) {
    case Mode.FVC:
      conditions = [{ mode: Mode.FVC, value: nftUpdateAuthority.address }];
      break;
    case Mode.VOC:
      conditions = [{ mode: Mode.VOC, value: collection.mint }];
      break;
    case Mode.MerkleTree: {
      // Setup a merkle tree with our mint as a leaf
      const {
        root,
        proofs: [p],
      } = await generateTreeOfSize(treeSize, [mint]);
      proof = p;
      conditions = [{ mode: Mode.MerkleTree, value: intoAddress(root) }];
      break;
    }
    default:
      throw new Error('Invalid whitelist mode');
  }

  // Create a whitelist and a funded pool.
  const { whitelist, pool } = await createPoolAndWhitelist({
    client,
    payer: poolOwner,
    owner: poolOwner,
    makerBroker: useMakerBroker ? makerBroker.address : undefined,
    cosigner: useCosigner ? cosigner : undefined,
    sharedEscrow,
    config,
    depositAmount,
    conditions,
    funded: sharedEscrow ? false : fundPool, // Shared Escrow pools can't be funded directly.
  });

  const poolAccount = await fetchPool(client.rpc, pool);

  // Correct pool type.
  t.assert(poolAccount.data.config.poolType === poolType);
  t.assert(
    poolAccount.data.config.mmFeeBps ===
      (poolType === PoolType.Trade ? config.mmFeeBps : null)
  );

  // Derives fee vault from mint and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  if (whitelistMode === Mode.MerkleTree) {
    // Create the mint proof for the whitelist.
    const mp = await upsertMintProof({
      client,
      payer,
      mint,
      whitelist,
      proof: proof!.proof,
    });
    mintProof = mp.mintProof;
  }

  switch (action) {
    case TestAction.Buy: {
      // Max price needs to account for royalties and mm fees.
      price = startingPrice + royalties + mmFees;

      // Deposit the NFT into the pool so it can be bought.
      const depositNftIx = await getDepositNftInstructionAsync({
        owner: nftOwner, // Same as poolOwner for Buy action
        pool,
        whitelist,
        mint,
        mintProof,
        tokenStandard: pNft
          ? TokenStandard.ProgrammableNonFungible
          : TokenStandard.NonFungible,
        authorizationRules: pNft ? ruleset : undefined,
      });

      await pipe(
        await createDefaultTransaction(client, poolOwner),
        (tx) =>
          appendTransactionMessageInstruction(
            getSetComputeUnitLimitInstruction({ units: 400_000 }),
            tx
          ),
        (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      await assertTokenNftOwnedBy({
        t,
        client,
        mint,
        owner: pool,
      });

      // Deposit Receipt should be created
      await assertNftReceiptCreated({ t, client, pool, mint });

      break;
    }
    case TestAction.Sell:
      // Min price needs to account for royalties and mm fees.
      price = startingPrice - royalties - mmFees;
      break;
    default:
      throw new Error('Invalid action');
  }

  return {
    client,
    signers: testSigners,
    nft,
    collection,
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
      sellerFeeBasisPoints: BigInt(sellerFeeBasisPoints),
    },
    whitelist,
    pool,
    feeVault,
    sharedEscrow,
    mintProof,
  };
}

export interface BuyLegacyTests {
  brokerPayments: boolean;
  cosigner?: Address;
  optionalRoyaltyPct?: number;
  creators?: Creator[];
  expectError?: number;
  pNft?: boolean;
  ruleset?: Address;
  checkCreatorBalances?: boolean;
  nftReceipt?: Address;
}

export async function testBuy(
  t: ExecutionContext,
  params: LegacyTest,
  tests: BuyLegacyTests
) {
  const { client, signers, nft, testConfig, pool } = params;

  const {
    buyer,
    poolOwner,
    nftUpdateAuthority,
    makerBroker,
    takerBroker,
    cosigner,
  } = signers;
  const { price: maxAmount, sellerFeeBasisPoints } = testConfig;
  const { mint } = nft;

  const creators = tests.creators ?? [
    { address: nftUpdateAuthority.address, share: 100, verified: true },
  ];

  const makerBrokerStartingBalance = await getBalance(
    client,
    makerBroker.address
  );
  const takerBrokerStartingBalance = await getBalance(
    client,
    takerBroker.address
  );
  const creatorStartingBalances = await Promise.all(
    creators.map(async (creator) => ({
      creator,
      balance: await getBalance(client, creator.address),
    }))
  );

  const poolAccount = await fetchPool(client.rpc, pool);
  const poolType = poolAccount.data.config.poolType;
  const poolNftsHeld = poolAccount.data.nftsHeld;

  // Price before the buy.
  // Exlude mm fee and royalties to get the raw price to calculate fees from.
  const startingPrice = BigInt(
    getCurrentAskPrice({
      pool: poolAccount.data,
      royaltyFeeBps: 0,
      extraOffset: 0,
      excludeMMFee: true,
    }) ?? 0n
  );

  const feeVaultStartingBalance = await getBalance(client, params.feeVault);

  const optionalRoyaltyPct = tests.pNft
    ? 100
    : (tests.optionalRoyaltyPct ?? undefined);

  const buyNftIx = await getBuyNftInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    makerBroker: tests.brokerPayments ? makerBroker.address : undefined,
    takerBroker: tests.brokerPayments ? takerBroker.address : undefined,
    cosigner: tests.cosigner ? cosigner : undefined,
    optionalRoyaltyPct,
    tokenStandard: tests.pNft
      ? TokenStandard.ProgrammableNonFungible
      : TokenStandard.NonFungible,
    authorizationRules: tests.pNft ? tests.ruleset : undefined,
    // Remaining accounts
    creators: creators.map(({ address }) => address),
    nftReceipt: tests.nftReceipt ?? undefined,
  });

  if (tests.expectError) {
    const promise = pipe(
      await createDefaultTransaction(client, buyer),
      (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );

    await expectCustomError(t, promise, tests.expectError);
    return;
  }

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) =>
      appendTransactionMessageInstruction(
        getSetComputeUnitLimitInstruction({ units: 400_000 }),
        tx
      ),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVaultEndingBalance = await getBalance(client, params.feeVault);

  // NFT is now owned by the buyer.
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
  });

  if (poolType === PoolType.NFT) {
    if (poolNftsHeld === 1) {
      // Pool is now closed as there are no more NFTs left to buy.
      const maybePool = await fetchMaybePool(client.rpc, pool);
      t.assert(maybePool.exists === false);
    }
  }

  if (poolType === PoolType.Trade) {
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

    // Deposit Receipt is closed
    await assertNftReceiptClosed({ t, client, pool, mint });
  }

  const takerFee = (TAKER_FEE_BPS * startingPrice) / BASIS_POINTS;
  const brokersFee = (BROKER_FEE_PCT * takerFee) / HUNDRED_PERCENT;
  const makerBrokerFee = (brokersFee * MAKER_BROKER_FEE_PCT) / HUNDRED_PERCENT;
  const takerBrokerFee = brokersFee - makerBrokerFee;
  const royaltyFee = (sellerFeeBasisPoints * startingPrice) / BASIS_POINTS;
  const appliedRoyaltyFee =
    (royaltyFee * BigInt(optionalRoyaltyPct ?? 0)) / HUNDRED_PERCENT;

  if (tests.brokerPayments) {
    const expectedMakerBrokerBalance =
      makerBrokerStartingBalance + makerBrokerFee;
    const expectedTakerBrokerBalance =
      takerBrokerStartingBalance + takerBrokerFee;

    const makerBrokerEndingBalance = await getBalance(
      client,
      makerBroker.address
    );
    const takerBrokerEndingBalance = await getBalance(
      client,
      takerBroker.address
    );

    t.assert(makerBrokerEndingBalance === expectedMakerBrokerBalance);
    t.assert(takerBrokerEndingBalance === expectedTakerBrokerBalance);
  }

  // Check verified creator balances for royalty payments if requested.
  if (tests.checkCreatorBalances) {
    for (const {
      creator,
      balance: creatorStartingBalance,
    } of creatorStartingBalances) {
      if (creator.verified) {
        const expectedCreatorBalance =
          creatorStartingBalance +
          (appliedRoyaltyFee * BigInt(creator.share)) / HUNDRED_PERCENT;
        const creatorEndingBalance = await getBalance(client, creator.address);
        t.assert(creatorEndingBalance === expectedCreatorBalance);
      }
    }
  }

  // Always check fee vault balance
  // Fee vault gets fee split of taker fee + brokers fee if brokers are not passed in.
  const expectedFeeVaultBalance =
    feeVaultStartingBalance +
    takerFee -
    (tests.brokerPayments ? brokersFee : 0n);

  // Fees can have a race-condition when many tests are run so this just needs to be higher or equal to the expected balance.
  t.assert(feeVaultEndingBalance >= expectedFeeVaultBalance);
}

export interface SellLegacyTests {
  brokerPayments: boolean;
  cosigner: boolean;
  optionalRoyaltyPct?: number;
  creators?: Creator[];
  expectError?: number;
  pNft?: boolean;
  ruleset?: Address;
  whitelist?: Address;
  checkCreatorBalances?: boolean;
  useSharedEscrow?: boolean;
}

export async function testSell(
  t: ExecutionContext,
  params: LegacyTest,
  tests: SellLegacyTests
) {
  const {
    client,
    signers,
    nft,
    testConfig,
    pool,
    whitelist,
    mintProof,
    sharedEscrow,
  } = params;

  const {
    buyer,
    poolOwner,
    nftOwner,
    nftUpdateAuthority,
    cosigner,
    makerBroker,
    takerBroker,
  } = signers;
  const { price: minPrice, sellerFeeBasisPoints } = testConfig;
  const { mint } = nft;

  const creators = tests.creators ?? [
    { address: nftUpdateAuthority.address, share: 100, verified: true },
  ];
  const creatorAddresses = creators.map(({ address }) => address);

  const makerBrokerStartingBalance = await getBalance(
    client,
    makerBroker.address
  );
  const takerBrokerStartingBalance = await getBalance(
    client,
    takerBroker.address
  );
  const creatorStartingBalances = await Promise.all(
    creators.map(async (creator) => ({
      creator,
      balance: await getBalance(client, creator.address),
    }))
  );

  const poolAccount = await fetchPool(client.rpc, pool);
  const poolType = poolAccount.data.config.poolType;
  const poolAmount = poolAccount.data.amount;

  // Price before the sell.
  // Exlude mm fee and royalties to get the raw price to calculate fees from.
  const startingPrice = BigInt(
    getCurrentBidPriceSync({
      pool: poolAccount.data,
      availableLamports: poolAmount,
      royaltyFeeBps: 0,
      extraOffset: 0,
      excludeMMFee: true,
    }) ?? 0n
  );

  const feeVaultStartingBalance = await getBalance(client, params.feeVault);

  const optionalRoyaltyPct = tests.pNft
    ? 100
    : (tests.optionalRoyaltyPct ?? undefined);

  let sellNftIx: IInstruction;

  if (poolType === PoolType.Trade) {
    // Sell NFT into pool
    sellNftIx = await getSellNftTradePoolInstructionAsync({
      owner: poolOwner.address, // pool owner
      taker: nftOwner, // nft owner--the seller
      pool,
      whitelist: tests.whitelist ?? whitelist, // override whitelist if passed in
      mint,
      mintProof,
      minPrice,
      makerBroker: tests.brokerPayments ? makerBroker.address : undefined,
      takerBroker: tests.brokerPayments ? takerBroker.address : undefined,
      cosigner: tests.cosigner ? cosigner : undefined,
      sharedEscrow: tests.useSharedEscrow ? sharedEscrow : undefined,
      escrowProgram: TSWAP_PROGRAM_ID,
      optionalRoyaltyPct,
      tokenStandard: tests.pNft
        ? TokenStandard.ProgrammableNonFungible
        : TokenStandard.NonFungible,
      authorizationRules: tests.pNft ? tests.ruleset : undefined,
      // Remaining accounts
      creators: creatorAddresses,
    });
  } else if (poolType === PoolType.Token) {
    sellNftIx = await getSellNftTokenPoolInstructionAsync({
      owner: poolOwner.address, // pool owner
      taker: nftOwner, // nft owner--the seller
      pool,
      whitelist: tests.whitelist ?? whitelist, // override whitelist if passed in
      mint,
      mintProof,
      minPrice,
      makerBroker: tests.brokerPayments ? makerBroker.address : undefined,
      takerBroker: tests.brokerPayments ? takerBroker.address : undefined,
      cosigner: tests.cosigner ? cosigner : undefined,
      sharedEscrow: tests.useSharedEscrow ? sharedEscrow : undefined,
      escrowProgram: TSWAP_PROGRAM_ID,
      optionalRoyaltyPct,
      tokenStandard: tests.pNft
        ? TokenStandard.ProgrammableNonFungible
        : TokenStandard.NonFungible,
      authorizationRules: tests.pNft ? tests.ruleset : undefined,
      // Remaining accounts
      creators: creatorAddresses,
    });
  } else {
    throw new Error('Invalid pool type');
  }

  if (tests.expectError) {
    const promise = pipe(
      await createDefaultTransaction(client, buyer),
      (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
      (tx) => signAndSendTransaction(client, tx)
    );

    await expectCustomError(t, promise, tests.expectError);
    return;
  }

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(COMPUTE_700K_IX, tx),
    (tx) => appendTransactionMessageInstruction(sellNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVaultEndingBalance = await getBalance(client, params.feeVault);

  // NFT is now owned by the pool or poo. owner
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: poolType === PoolType.Trade ? pool : poolOwner.address,
  });

  if (poolType === PoolType.Token) {
    // Pool is closed if there is not enough balance for it to buy another NFT.
    if (poolAmount < startingPrice) {
      // Pool is now closed as there are no more tokens left to sell.
      const maybePool = await fetchMaybePool(client.rpc, pool);
      t.assert(maybePool.exists === false);
    }
  }

  if (poolType === PoolType.Trade) {
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

    // Deposit Receipt is created
    await assertNftReceiptCreated({ t, client, pool, mint });
  }

  const takerFee = (TAKER_FEE_BPS * startingPrice) / BASIS_POINTS;
  const brokersFee = (BROKER_FEE_PCT * takerFee) / HUNDRED_PERCENT;
  const makerBrokerFee = (brokersFee * MAKER_BROKER_FEE_PCT) / HUNDRED_PERCENT;
  const takerBrokerFee = brokersFee - makerBrokerFee;
  const royaltyFee = (sellerFeeBasisPoints * startingPrice) / BASIS_POINTS;
  const appliedRoyaltyFee =
    (royaltyFee * BigInt(optionalRoyaltyPct ?? 0)) / HUNDRED_PERCENT;

  if (tests.brokerPayments) {
    t.log('checking broker payments');
    const expectedMakerBrokerBalance =
      makerBrokerStartingBalance + makerBrokerFee;
    const expectedTakerBrokerBalance =
      takerBrokerStartingBalance + takerBrokerFee;

    const makerBrokerEndingBalance = await getBalance(
      client,
      makerBroker.address
    );
    const takerBrokerEndingBalance = await getBalance(
      client,
      takerBroker.address
    );

    t.assert(makerBrokerEndingBalance === expectedMakerBrokerBalance);
    t.assert(takerBrokerEndingBalance === expectedTakerBrokerBalance);
  }

  // Check verified creator balances for royalty payments if requested.
  if (tests.checkCreatorBalances) {
    for (const {
      creator,
      balance: creatorStartingBalance,
    } of creatorStartingBalances) {
      if (creator.verified) {
        const expectedCreatorBalance =
          creatorStartingBalance +
          (appliedRoyaltyFee * BigInt(creator.share)) / HUNDRED_PERCENT;
        const creatorEndingBalance = await getBalance(client, creator.address);
        t.assert(creatorEndingBalance === expectedCreatorBalance);
      }
    }
  }

  // Always check fee vault balance
  // Fee vault gets fee split of taker fee + brokers fee if brokers are not passed in.
  const expectedFeeVaultBalance =
    feeVaultStartingBalance +
    takerFee -
    (tests.brokerPayments ? brokersFee : 0n);

  // Fees can have a race-condition when many tests are run so this just needs to be higher or equal to the expected balance.
  t.assert(feeVaultEndingBalance >= expectedFeeVaultBalance);
}
