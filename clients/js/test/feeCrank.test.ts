import {
  address,
  airdropFactory,
  appendTransactionInstruction,
  lamports,
  pipe,
  setTransactionFeePayerSigner,
} from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import test from 'ava';
import {
  CurveType,
  PoolConfig,
  PoolType,
  getDepositSolInstruction,
  getFeeCrankInstruction,
} from '../src/index.js';
import {
  ONE_SOL,
  ZERO_ACCOUNT_RENT_LAMPORTS,
  createPool,
  createWhitelistV2,
  mintAndSellIntoPool,
} from './_common.js';

test('it can collect fees from sharded fee accounts', async (t) => {
  // Need a longer timeout because of all the minting and nft selling we perform.
  t.timeout(30_000);

  const client = createDefaultSolanaClient();

  const payer = await generateKeyPairSignerWithSol(client);

  const fdnTreasury = address('Hnozy7VdXR1ua2FZQyvxRgoCbn2dnpVZh3vZN9BMzDea');

  await airdropFactory(client)({
    recipientAddress: fdnTreasury,
    lamports: lamports(ONE_SOL),
    commitment: 'confirmed',
  });

  const poolOwner = await generateKeyPairSignerWithSol(client);
  const nftOwner = await generateKeyPairSignerWithSol(client);

  // Lots of SOL so we can experiment with minting and collecting from lots of accounts.
  await airdropFactory(client)({
    recipientAddress: poolOwner.address,
    lamports: lamports(100n * ONE_SOL),
    commitment: 'confirmed',
  });

  await airdropFactory(client)({
    recipientAddress: nftOwner.address,
    lamports: lamports(100n * ONE_SOL),
    commitment: 'confirmed',
  });

  const config: PoolConfig = {
    poolType: PoolType.Trade,
    curveType: CurveType.Linear,
    startingPrice: 1_000_000n,
    delta: 0n,
    mmCompoundFees: false,
    mmFeeBps: 100,
  };

  // Create whitelist with FVC where the NFT owner is the FVC.
  const { whitelist } = await createWhitelistV2({
    client,
    updateAuthority: poolOwner,
    conditions: [{ mode: Mode.FVC, value: nftOwner.address }],
  });

  // Create pool and whitelist
  const { pool } = await createPool({
    client,
    whitelist,
    owner: poolOwner,
    config,
  });

  // Fund Pool
  const depositSolIx = getDepositSolInstruction({
    pool,
    whitelist,
    owner: poolOwner,
    lamports: 50n * ONE_SOL,
  });

  await pipe(
    await createDefaultTransaction(client, poolOwner),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const numMints = 6;
  const feeAccounts = [];
  const feeSeeds = [];

  for (let i = 0; i < numMints; i++) {
    // Mint and sell
    const { feeVault, shard, bump } = await mintAndSellIntoPool({
      client,
      pool,
      whitelist,
      poolOwner,
      nftOwner,
    });

    feeAccounts.push(feeVault);
    feeSeeds.push({
      shard,
      bump,
    });
  }

  const collectFeesIx = getFeeCrankInstruction({
    treasury: fdnTreasury,
    feeSeeds,
    // Remaining accounts
    feeAccounts,
  });

  await pipe(
    await createDefaultTransaction(client, payer),
    (tx) => setTransactionFeePayerSigner(payer, tx),
    (tx) => appendTransactionInstruction(collectFeesIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  for (const fv of feeAccounts) {
    const balance = (await client.rpc.getBalance(fv).send()).value;
    // Only keep-alive state bond left.
    t.assert(balance === ZERO_ACCOUNT_RENT_LAMPORTS);
  }

  const treasuryBalance = (await client.rpc.getBalance(fdnTreasury).send())
    .value;
  t.assert(treasuryBalance > ONE_SOL);
});
