import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  AssetV1,
  CollectionV1,
  Creator,
  createDefaultAssetWithCollection,
  fetchAssetV1,
} from '@tensor-foundation/mpl-core';
import {
  Client,
  createDefaultSolanaClient,
  createDefaultTransaction,
  getBalance,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Condition, Mode, intoAddress } from '@tensor-foundation/whitelist';
import { ExecutionContext } from 'ava';
import {
  Pool,
  PoolConfig,
  PoolType,
  fetchMaybePool,
  fetchPool,
  getBuyNftCoreInstructionAsync,
  getDepositNftCoreInstructionAsync,
} from '../../src/index.js';
import {
  BASIS_POINTS,
  BROKER_FEE_PCT,
  COMPUTE_300K_IX,
  HUNDRED_PERCENT,
  MAKER_BROKER_FEE_PCT,
  SetupTestParams,
  TAKER_FEE_BPS,
  TestAction,
  TestConfig,
  TestSigners,
  assertNftReceiptClosed,
  assertNftReceiptCreated,
  createAndFundEscrow,
  createPoolAndWhitelist,
  expectCustomError,
  getAndFundFeeVault,
  getTestSigners,
  nftPoolConfig,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';
import { generateTreeOfSize } from '../_merkle.js';

export interface MplCoreTest {
  client: Client;
  signers: TestSigners;
  asset: Account<AssetV1>;
  collection: Account<CollectionV1>;
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  mintProof?: Address;
  sharedEscrow: Address | undefined;
}

export async function setupCoreTest(
  params: SetupTestParams & {
    creators?: Creator[];
  }
): Promise<MplCoreTest> {
  const {
    t,
    poolType,
    action,
    whitelistMode = Mode.VOC,
    depositAmount: dA,
    useMakerBroker = false,
    useSharedEscrow = false,
    useCosigner = false,
    compoundFees = false,
    fundPool = true,
  } = params;
  const client = createDefaultSolanaClient();
  const testSigners = await getTestSigners(client);

  const { payer, poolOwner, nftUpdateAuthority, cosigner, makerBroker } =
    testSigners;

  let { nftOwner } = testSigners;

  // When buying, we mint the NFT to the poolOwner which then deposits it into the
  // pool so it can be purchased by the buyer.
  if (action == TestAction.Buy) {
    nftOwner = poolOwner;
  }

  let sellerFeeBasisPoints = 500;

  // Mint NFT
  const [asset, collection] = await createDefaultAssetWithCollection({
    client,
    payer,
    collectionAuthority: nftUpdateAuthority,
    owner: nftOwner.address,
    royalties: {
      creators: params.creators ?? [
        {
          percentage: 100,
          address: nftUpdateAuthority.address,
        },
      ],
      basisPoints: sellerFeeBasisPoints,
    },
  });

  // Reset test timeout for long-running tests.
  t.pass();

  let config: PoolConfig;
  let price: bigint;
  let mmFees = 0n;

  let startingPrice;

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

  const royalties =
    (startingPrice * BigInt(sellerFeeBasisPoints)) / BASIS_POINTS;

  const depositAmount = dA ?? config.startingPrice * 10n;

  let sharedEscrow: Address | undefined;

  if (useSharedEscrow) {
    // Create a shared escrow account.
    sharedEscrow = await createAndFundEscrow(client, poolOwner, 1);
  }

  let conditions: Condition[] = [];
  let mintProof: Address | undefined;
  let proof;

  switch (whitelistMode) {
    case Mode.FVC:
      conditions = [{ mode: Mode.FVC, value: nftUpdateAuthority.address }];
      break;
    case Mode.VOC:
      conditions = [{ mode: Mode.VOC, value: collection.address }];
      break;
    case Mode.MerkleTree: {
      // Setup a merkle tree with our mint as a leaf
      const {
        root,
        proofs: [p],
      } = await generateTreeOfSize(10, [asset.address]);
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

  // Derives fee vault from the pool and airdrops keep-alive rent to it.
  const feeVault = await getAndFundFeeVault(client, pool);

  if (whitelistMode === Mode.MerkleTree) {
    // Create the mint proof for the whitelist.
    const mp = await upsertMintProof({
      client,
      payer,
      mint: asset.address,
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
      const depositNftIx = await getDepositNftCoreInstructionAsync({
        owner: nftOwner,
        pool,
        whitelist,
        mintProof,
        asset: asset.address,
        collection: collection.address,
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

      // The pool is now the owner of the asset.
      t.like(await fetchAssetV1(client.rpc, asset.address), <
        Account<AssetV1, Address>
      >{
        address: asset.address,
        data: {
          owner: pool,
        },
      });

      // Deposit Receipt should be created
      await assertNftReceiptCreated({ t, client, pool, mint: asset.address });

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
    asset,
    collection,
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
      sellerFeeBasisPoints: BigInt(sellerFeeBasisPoints),
    },
    mintProof,
    whitelist,
    pool,
    feeVault,
    sharedEscrow,
  };
}

export interface BuyMplCoreTests {
  brokerPayments: boolean;
  optionalRoyaltyPct?: number;
  creators?: Creator[];
  expectError?: number;
  checkCreatorBalances?: boolean;
}

export async function testBuyNft(
  t: ExecutionContext,
  params: MplCoreTest,
  tests: BuyMplCoreTests
) {
  const {
    client,
    signers,
    asset,
    collection,
    testConfig,
    pool,
    whitelist,
    mintProof,
  } = params;

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { price: maxAmount, sellerFeeBasisPoints } = testConfig;
  const mint = asset.address;

  const creators = tests.creators ?? [
    { address: nftUpdateAuthority.address, percentage: 100 },
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

  const feeVaultStartingBalance = await getBalance(client, params.feeVault);

  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    whitelist,
    mintProof,
    asset: mint,
    collection: collection.address,
    maxAmount,
    makerBroker: tests.brokerPayments ? makerBroker.address : undefined,
    takerBroker: tests.brokerPayments ? takerBroker.address : undefined,
    creators: creators.map(({ address }) => address) ?? [
      nftUpdateAuthority.address,
    ],
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
    (tx) => appendTransactionMessageInstruction(COMPUTE_300K_IX, tx),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const feeVaultEndingBalance = await getBalance(client, params.feeVault);

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, mint), <Account<AssetV1, Address>>{
    address: mint,
    data: {
      owner: buyer.address,
    },
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

  const startingPrice = poolAccount.data.config.startingPrice;

  const takerFee = (TAKER_FEE_BPS * startingPrice) / BASIS_POINTS;
  const brokersFee = (BROKER_FEE_PCT * takerFee) / HUNDRED_PERCENT;
  const makerBrokerFee = (brokersFee * MAKER_BROKER_FEE_PCT) / HUNDRED_PERCENT;
  const takerBrokerFee = brokersFee - makerBrokerFee;
  const royaltyFee = (sellerFeeBasisPoints * startingPrice) / BASIS_POINTS;

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

  // Check creator balances for royalty payments.
  if (tests.checkCreatorBalances) {
    for (const {
      creator,
      balance: creatorStartingBalance,
    } of creatorStartingBalances) {
      const expectedCreatorBalance =
        creatorStartingBalance +
        (royaltyFee * BigInt(creator.percentage)) / HUNDRED_PERCENT;
      const creatorEndingBalance = await getBalance(client, creator.address);
      t.assert(creatorEndingBalance === expectedCreatorBalance);
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
