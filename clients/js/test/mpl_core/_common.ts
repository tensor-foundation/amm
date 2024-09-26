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
  createDefaultAssetWithCollection,
  fetchAssetV1,
} from '@tensor-foundation/mpl-core';
import {
  Client,
  createDefaultSolanaClient,
  createDefaultTransaction,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Condition, Mode, intoAddress } from '@tensor-foundation/whitelist';
import {
  PoolConfig,
  PoolType,
  fetchPool,
  getDepositNftCoreInstructionAsync,
} from '../../src/index.js';
import {
  BASIS_POINTS,
  SetupTestParams,
  TestAction,
  TestConfig,
  TestSigners,
  assertNftReceiptCreated,
  createAndFundEscrow,
  createPoolAndWhitelist,
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
  params: SetupTestParams
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
      creators: [
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
