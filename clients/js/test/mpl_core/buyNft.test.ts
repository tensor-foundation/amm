import {
  Account,
  Address,
  appendTransactionMessageInstruction,
  pipe,
} from '@solana/web3.js';
import { AssetV1, fetchAssetV1 } from '@tensor-foundation/mpl-core';
import {
  createDefaultTransaction,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import test from 'ava';
import {
  Pool,
  PoolType,
  fetchPool,
  getBuyNftCoreInstructionAsync,
} from '../../src/index.js';
import { TestAction, assertNftReceiptClosed } from '../_common.js';
import { setupCoreTest } from './_common.js';

test('it can buy an NFT from a Trade pool', async (t) => {
  const { client, signers, asset, collection, testConfig, pool, feeVault } =
    await setupCoreTest({
      t,
      poolType: PoolType.Trade,
      action: TestAction.Buy,
      useSharedEscrow: false,
      fundPool: false,
    });

  const { buyer, poolOwner, nftUpdateAuthority } = signers;
  const { poolConfig } = testConfig;

  // Max amount is the maximum price the user is willing to pay for the NFT + creators fee and mm fee, if applicable.
  const mmFee = poolConfig.startingPrice * BigInt(poolConfig.mmFeeBps ?? 0);
  const royalties = (poolConfig.startingPrice * 500n) / 10000n;
  // It should work with exact amount, but users might also pad this to allow for slippage.
  const maxAmount = poolConfig.startingPrice + mmFee + royalties;

  const startingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;

  // Buy NFT from pool
  const buyNftIx = await getBuyNftCoreInstructionAsync({
    owner: poolOwner.address,
    buyer,
    pool,
    asset: asset.address,
    collection: collection.address,
    maxAmount,
    // Remaining accounts
    creators: [nftUpdateAuthority.address],
  });

  await pipe(
    await createDefaultTransaction(client, buyer),
    (tx) => appendTransactionMessageInstruction(buyNftIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // NFT is now owned by the buyer.
  t.like(await fetchAssetV1(client.rpc, asset.address), <
    Account<AssetV1, Address>
  >{
    address: asset.address,
    data: {
      owner: buyer.address,
    },
  });

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

  // Fee vault balance increases.
  const endingFeeVaultBalance = (await client.rpc.getBalance(feeVault).send())
    .value;
  t.assert(endingFeeVaultBalance > startingFeeVaultBalance);

  // Deposit Receipt is closed
  await assertNftReceiptClosed({ t, client, pool, mint: asset.address });
});
