import test from 'ava';
import {} from '@solana/programs';
import {
  Address,
  Commitment,
  CompilableTransaction,
  ITransactionWithBlockhashLifetime,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  address,
  appendTransactionInstruction,
  getSignatureFromTransaction,
  isSolanaError,
  none,
  pipe,
  sendAndConfirmTransactionFactory,
  signTransactionWithSigners,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
  Client,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
} from '@tensor-foundation/test-helpers';
import {
  createDefaultNft,
  findTokenRecordPda,
} from '@tensor-foundation/toolkit-token-metadata';
import {
  Pool,
  fetchMaybePool,
  fetchMaybeSolEscrow,
  fetchPool,
  getClosePoolInstruction,
  getDepositNftInstruction,
  findEscrowTokenAccountPda,
  findNftDepositReceiptPda,
  PoolType,
  CurveType,
  getDepositSolInstruction,
  PoolConfig,
  getSellNftTokenPoolInstruction,
} from '../src/index.js';
import { createPoolAndWhitelist } from './_common.js';

const pnftShared = {
  tokenMetadata: MPL_TOKEN_METADATA_PROGRAM_ID,
  authorizationRulesProgram: address(
    'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg'
  ),
  instructions: address('Sysvar1nstructions1111111111111111111111111'),
};

export const signAndSendTransaction = async (
  client: Client,
  transaction: CompilableTransaction & ITransactionWithBlockhashLifetime,
  commitment: Commitment = 'confirmed',
  skipPreflight = false
) => {
  const signedTransaction = await signTransactionWithSigners(transaction);
  const signature = getSignatureFromTransaction(signedTransaction);
  await sendAndConfirmTransactionFactory(client)(signedTransaction, {
    commitment: commitment ?? 'confirmed',
    skipPreflight,
  });

  return signature;
};

test('it can close a pool', async (t) => {
  const client = createDefaultSolanaClient();

  // Create default pool
  const { pool, owner, solEscrow } = await createPoolAndWhitelist({ client });

  const poolAccount = await fetchPool(client.rpc, pool);
  // Then an account was created with the correct data.
  t.like(poolAccount, <Pool>(<unknown>{
    address: pool,
    data: {
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: none(),
      },
    },
  }));

  // Close the pool
  const closePoolIx = getClosePoolInstruction({
    owner,
    pool,
    solEscrow,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then the pool and solEscrow are closed
  const maybePoolAccount = await fetchMaybePool(client.rpc, pool);
  t.assert(!maybePoolAccount.exists);
  const maybeSolEscrowAccount = await fetchMaybeSolEscrow(
    client.rpc,
    solEscrow
  );
  t.assert(!maybeSolEscrowAccount.exists);
});

test('close pool fails if nfts still deposited', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);

  // Create pool and whitelist
  const { pool, whitelist, solEscrow } = await createPoolAndWhitelist({
    client,
    owner,
  });

  // Mint NFTs
  const { mint, metadata, masterEdition, token } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  const [escrowTokenAccount] = await findEscrowTokenAccountPda({ mint });
  const [nftReceipt] = await findNftDepositReceiptPda({ mint });
  const [ownerTokenRecord1] = await findTokenRecordPda({
    mint,
    token,
  });
  const [destTokenRecord1] = await findTokenRecordPda({
    mint,
    token: escrowTokenAccount,
  });

  // Deposit NFT1 into pool
  const depositPoolIx = getDepositNftInstruction({
    pool,
    whitelist,
    owner,
    sourceTokenAccount: token,
    mint,
    metadata,
    escrowTokenAccount,
    nftReceipt,
    edition: masterEdition,
    ownerTokenRecord: ownerTokenRecord1,
    destTokenRecord: destTokenRecord1,
    associatedTokenProgram: ASSOCIATED_TOKEN_ACCOUNTS_PROGRAM_ID,
    tokenMetadataProgram: pnftShared.tokenMetadata,
    instructions: pnftShared.instructions,
    authorizationRulesProgram: pnftShared.authorizationRulesProgram,
    config: {
      poolType: PoolType.NFT,
      curveType: CurveType.Linear,
      startingPrice: 0,
      delta: 0,
      mmCompoundFees: false,
      mmFeeBps: null,
    },
    authorizationData: null,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx, 'confirmed', true)
  );

  // Close pool
  const closePoolIx = getClosePoolInstruction({
    owner,
    pool,
    solEscrow,
  });

  const promise = pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(closePoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  // ExistingNfts
  const code = 12013;

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
});

interface SellNftShared {
  owner: ReturnType<typeof generateKeyPairSignerWithSol>;
  seller: ReturnType<typeof generateKeyPairSignerWithSol>;
  feeVault: Address;
  pool: Address;
  whitelist: Address;
  mintProof: Address;
  nftSellerAccount: Address;
  mint: Address;
  metadata: Address;
  solEscrow: string;
}

test.only('close pool fails if someone sold nfts into it', async (t) => {
  const client = createDefaultSolanaClient();

  const owner = await generateKeyPairSignerWithSol(client);

  const config: PoolConfig = {
    poolType: PoolType.Token,
    curveType: CurveType.Linear,
    startingPrice: 100_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: none(),
  };

  // Create pool and whitelist
  const { pool, whitelist, solEscrow } = await createPoolAndWhitelist({
    client,
    owner,
    config,
  });

  // Mint NFT
  const { mint, metadata } = await createDefaultNft(
    client,
    owner,
    owner,
    owner
  );

  // Deposit SOL
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    solEscrow,
    owner,
    lamports: 1_000_000n,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Sell NFT into pool
  let sellNftIx = getSellNftTokenPoolInstruction({
    shared: {
      owner: owner.address,
      seller: owner.address,
      feeVault: owner.address,
      pool,
      whitelist,
      mintProof: mint,
      nftSellerAccount: metadata,
      mint,
      metadata,
      solEscrow,1
    },
  });

  t.pass();
});

// test('closing the pool roundtrips fees + deposited SOL', async (t) => {
//   // Todo: Implement this test
//   // requires importing/porting over a bunch of tensor-common helpers
// t.pass();
// });

// test('it closes the pool and withdraws SOL from any buys in the TRADE pool', async (t) => {
//   const client = createDefaultSolanaClient();
//   const owner = await generateKeyPairSignerWithSol(client);
//   const buyer = await generateKeyPairSignerWithSol(client);
//   const config = tradePoolConfig;
//   const buyPrice = LAMPORTS_PER_SOL;

//   t.pass();
// });
