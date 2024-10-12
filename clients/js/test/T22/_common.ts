import { Token, fetchToken } from '@solana-program/token';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import { Creator } from '@tensor-foundation/mpl-token-metadata';
import {
  Client,
  T22NftReturn,
  TOKEN22_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22NftWithRoyalties,
  getBalance,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode, intoAddress } from '@tensor-foundation/whitelist';
import { ExecutionContext } from 'ava';
import {
  NftDepositReceipt,
  Pool,
  PoolConfig,
  PoolType,
  fetchMaybePool,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getBuyNftT22InstructionAsync,
  getDepositNftT22InstructionAsync,
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
  assertTokenNftOwnedBy,
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

export interface T22Test {
  client: Client;
  signers: TestSigners;
  nft: T22NftReturn;
  testConfig: TestConfig;
  whitelist: Address;
  pool: Address;
  feeVault: Address;
  mintProof: Address;
  sharedEscrow: Address | undefined;
}

export async function setupT22Test(
  params: SetupTestParams & {
    creator?: Creator;
    poolConfig?: PoolConfig | null;
  }
): Promise<T22Test> {
  const {
    t,
    poolType,
    action,
    depositAmount: dA,
    useMakerBroker = false,
    useSharedEscrow = false,
    useCosigner = false,
    compoundFees = false,
    fundPool = true,
    creator,
    poolConfig,
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

  const royaltyDestinationString =
    '_ro_' + (creator ? creator.address : nftUpdateAuthority.address);
  const sellerFeeBasisPoints = 500n;

  // Mint NFT
  const t22Nft = await createT22NftWithRoyalties({
    client,
    payer: nftOwner,
    owner: nftOwner.address,
    mintAuthority: nftUpdateAuthority,
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
  });

  const { mint, ownerAta, extraAccountMetas } = t22Nft;

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

  const royalties = (startingPrice * sellerFeeBasisPoints) / BASIS_POINTS;
  const depositAmount = dA ?? startingPrice * 10n;

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

  // Setup a merkle tree with our mint as a leaf
  const {
    root,
    proofs: [p],
  } = await generateTreeOfSize(10, [mint]);

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
    conditions: [{ mode: Mode.MerkleTree, value: intoAddress(root) }],
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

  // Create the mint proof for the whitelist.
  const { mintProof } = await upsertMintProof({
    client,
    payer,
    mint,
    whitelist,
    proof: p.proof,
  });

  switch (action) {
    case TestAction.Buy: {
      // Max price needs to account for royalties and mm fees.
      price = startingPrice + royalties + mmFees;

      // Deposit the NFT into the pool so it can be bought.
      const depositNftIx = await getDepositNftT22InstructionAsync({
        owner: nftOwner, // Same as poolOwner for Buy action
        pool,
        whitelist,
        mint,
        mintProof,
        tokenProgram: TOKEN22_PROGRAM_ID,
        transferHookAccounts: extraAccountMetas.map((a) => a.address),
      });

      await pipe(
        await createDefaultTransaction(client, poolOwner),
        (tx) => appendTransactionMessageInstruction(depositNftIx, tx),
        (tx) => signAndSendTransaction(client, tx)
      );

      await assertTokenNftOwnedBy({
        t,
        client,
        mint,
        owner: pool,
        tokenProgramAddress: TOKEN22_PROGRAM_ID,
      });

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
    nft: t22Nft,
    testConfig: {
      poolConfig: config,
      depositAmount,
      price,
      sellerFeeBasisPoints,
    },
    whitelist,
    pool,
    feeVault,
    mintProof,
    sharedEscrow,
  };
}

export interface BuyT22Tests {
  brokerPayments: boolean;
  creator?: Address;
  expectError?: number;
  checkCreatorBalances?: boolean;
}

export async function testBuyNft(
  t: ExecutionContext,
  params: T22Test,
  tests: BuyT22Tests
) {
  const { client, signers, nft, testConfig, pool } = params;

  const { buyer, poolOwner, nftUpdateAuthority, makerBroker, takerBroker } =
    signers;
  const { price: maxAmount, sellerFeeBasisPoints } = testConfig;
  const { mint, extraAccountMetas } = nft;

  const creator = tests.creator ?? nftUpdateAuthority.address;

  const makerBrokerStartingBalance = await getBalance(
    client,
    makerBroker.address
  );
  const takerBrokerStartingBalance = await getBalance(
    client,
    takerBroker.address
  );
  const creatorStartingBalance = await getBalance(client, creator);

  const poolAccount = await fetchPool(client.rpc, pool);
  const poolType = poolAccount.data.config.poolType;
  const poolNftsHeld = poolAccount.data.nftsHeld;

  const feeVaultStartingBalance = await getBalance(client, params.feeVault);

  const buyNftIx = await getBuyNftT22InstructionAsync({
    owner: poolOwner.address,
    taker: buyer,
    pool,
    mint,
    maxAmount,
    makerBroker: tests.brokerPayments ? makerBroker.address : undefined,
    takerBroker: tests.brokerPayments ? takerBroker.address : undefined,
    tokenProgram: TOKEN22_PROGRAM_ID,
    // Remaining accounts
    creators: [creator],
    transferHookAccounts: extraAccountMetas.map((a) => a.address),
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
  await assertTokenNftOwnedBy({
    t,
    client,
    mint,
    owner: buyer.address,
    tokenProgramAddress: TOKEN22_PROGRAM_ID,
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

  // Check verified creator balances for royalty payments if requested.
  if (tests.checkCreatorBalances) {
    const expectedCreatorBalance = creatorStartingBalance + royaltyFee;
    const creatorEndingBalance = await getBalance(client, creator);
    t.assert(creatorEndingBalance === expectedCreatorBalance);
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
