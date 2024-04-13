import test from 'ava';
import {} from '@solana/programs';
import {
  airdropFactory,
  appendTransactionInstruction,
  lamports,
  pipe,
  some,
} from '@solana/web3.js';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  createKeyPairSigner,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import { Mode } from '@tensor-foundation/whitelist';
import {
  PoolType,
  CurveType,
  getDepositSolInstruction,
  PoolConfig,
  getFeeCrankInstruction,
} from '../src/index.js';
import {
  ONE_SOL,
  ZERO_ACCOUNT_RENT_LAMPORTS,
  createPool,
  createWhitelistV2,
  mintAndSellIntoPool,
} from './_common.js';
import { readFileSync } from 'fs';

test('it can collect fees from sharded fee accounts', async (t) => {
  // Need a longer timeout because of all the minting and nft selling we perform.
  t.timeout(30_000);

  const client = createDefaultSolanaClient();

  // Fee authority.
  const feeAuthorityBytes = Buffer.from(
    JSON.parse(
      readFileSync('../rust/tests/fixtures/test-keypair.json').toString()
    )
  );
  const feeAuthority = await createKeyPairSigner(feeAuthorityBytes);

  await airdropFactory(client)({
    recipientAddress: feeAuthority.address,
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
    mmFeeBps: some(100),
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
    await createDefaultTransaction(client, poolOwner.address),
    (tx) => appendTransactionInstruction(depositSolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const numMints = 10;
  const feeAccounts = [];
  const feeSeeds = [];

  for (let i = 0; i < numMints; i++) {
    // Mint and sell
    const { feeVault, index, bump } = await mintAndSellIntoPool({
      client,
      pool,
      whitelist,
      poolOwner,
      nftOwner,
    });

    feeAccounts.push(feeVault);
    feeSeeds.push({
      index,
      bump,
    });
  }

  const collectFeesIx = getFeeCrankInstruction({
    authority: feeAuthority,
    feeSeeds,
    // Remaining accounts
    feeAccounts,
  });

  await pipe(
    await createDefaultTransaction(client, feeAuthority.address),
    (tx) => appendTransactionInstruction(collectFeesIx, tx),
    (tx) => signAndSendTransaction(client, tx, { skipPreflight: true })
  );

  for (const fv of feeAccounts) {
    const balance = (await client.rpc.getBalance(fv).send()).value;
    // Only keep-alive state bond left.
    t.assert(balance === ZERO_ACCOUNT_RENT_LAMPORTS);
  }
});
