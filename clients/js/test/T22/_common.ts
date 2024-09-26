import { Token, fetchToken } from '@solana-program/token';
import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import {
  Client,
  T22NftReturn,
  TOKEN22_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  createT22NftWithRoyalties,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode, intoAddress } from '@tensor-foundation/whitelist';
import {
  NftDepositReceipt,
  PoolConfig,
  PoolType,
  fetchNftDepositReceipt,
  fetchPool,
  findNftDepositReceiptPda,
  getDepositNftT22InstructionAsync,
} from '../../src/index.js';
import { generateTreeOfSize } from '../_merkle.js';
import {
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

export async function setupT22Test(params: SetupTestParams): Promise<T22Test> {
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

  const royaltyDestinationString = '_ro_' + nftUpdateAuthority.address;
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
