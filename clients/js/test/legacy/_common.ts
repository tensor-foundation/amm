import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { Token, fetchToken } from '@solana-program/token';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  Nft,
  TokenStandard,
  createDefaultNftInCollection,
  fetchMetadata,
} from '@tensor-foundation/mpl-token-metadata';
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
  getDepositNftInstructionAsync,
} from '../../src/index.js';
import { generateTreeOfSize } from '../_merkle.js';
import {
  assertNftReceiptCreated,
  assertTokenNftOwnedBy,
  BASIS_POINTS,
  createAndFundEscrow,
  createPoolAndWhitelist,
  getAndFundFeeVault,
  getTestSigners,
  nftPoolConfig,
  SetupTestParams,
  TestAction,
  TestConfig,
  TestSigners,
  tokenPoolConfig,
  tradePoolConfig,
  upsertMintProof,
} from '../_common.js';

export interface LegacyTest {
  client: Client;
  signers: TestSigners;
  nft: Nft;
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  sharedEscrow: Address | undefined;
}

export async function setupLegacyTest(
  params: SetupTestParams & { pNft?: boolean }
): Promise<LegacyTest> {
  const {
    t,
    poolType,
    action,
    whitelistMode = Mode.FVC,
    depositAmount: dA,
    pNft = false,
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

  // Mint NFT
  const { collection, item: nft } = await createDefaultNftInCollection({
    client,
    payer,
    authority: nftUpdateAuthority,
    owner: nftOwner,
    standard: pNft
      ? TokenStandard.ProgrammableNonFungible
      : TokenStandard.NonFungible,
  });

  // Reset test timeout for long-running tests.
  t.pass();

  const { mint, token: ownerAta } = nft;

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

  const md = (await fetchMetadata(client.rpc, nft.metadata)).data;
  const { sellerFeeBasisPoints } = md;

  const royalties =
    (startingPrice * BigInt(sellerFeeBasisPoints)) / BASIS_POINTS;

  const depositAmount = dA ?? config.startingPrice * 10n;

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
      conditions = [{ mode: Mode.VOC, value: collection.mint }];
      break;
    case Mode.MerkleTree: {
      // Setup a merkle tree with our mint as a leaf
      const {
        root,
        proofs: [p],
      } = await generateTreeOfSize(10, [mint]);
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
    makerBroker: makerBroker.address,
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

  switch (action) {
    case TestAction.Buy: {
      // Max price needs to account for royalties and mm fees.
      price = startingPrice + royalties + mmFees;

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
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
    },
    whitelist,
    pool,
    feeVault,
    sharedEscrow,
  };
}
