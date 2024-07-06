import {
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  Rpc,
} from '@solana/web3.js';
import { CurveType, Pool, PoolType, findPoolPda } from '../generated';
import { DEFAULT_ADDRESS } from './nullableAddress';

export async function getCurrentBidPrice(
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>,
  pool: Pool
): Promise<bigint | null> {
  const bidPrice = calculateBidPrice(pool);
  if (!bidPrice) return bidPrice;
  if (!pool.sharedEscrow || pool.sharedEscrow === DEFAULT_ADDRESS)
    return pool.amount >= bidPrice ? bidPrice : null;
  const [poolAddress] = await findPoolPda({
    owner: pool.owner,
    poolId: pool.poolId,
  });
  const [escrowLamports, escrowDataLength] = await rpc
    .getAccountInfo(poolAddress)
    .send()
    .then((resp) => {
      return [resp.value?.lamports, resp.value?.data.length];
    });
  if (!escrowLamports || !escrowDataLength) return null;
  const rentExemption = await rpc
    .getMinimumBalanceForRentExemption(BigInt(escrowDataLength))
    .send();
  return BigInt(escrowLamports) - rentExemption >= bidPrice ? bidPrice : null;
}

function calculateBidPrice(pool: Pool): bigint | null {
  if (
    pool.config.poolType === PoolType.NFT ||
    (pool.priceOffset === pool.maxTakerSellCount &&
      pool.maxTakerSellCount !== 0 &&
      !!pool.sharedEscrow &&
      pool.sharedEscrow !== DEFAULT_ADDRESS)
  )
    return null;
  if (pool.priceOffset === 0) return pool.config.startingPrice;
  if (pool.config.curveType === CurveType.Exponential) {
    return pool.priceOffset > 0
      ? pool.config.startingPrice /
          (1n + pool.config.delta / 100_00n) ** BigInt(pool.priceOffset)
      : pool.config.startingPrice *
          (1n + pool.config.delta / 100_00n) ** BigInt(pool.priceOffset * -1);
  } else if (pool.config.curveType === CurveType.Linear) {
    return (
      pool.config.startingPrice - pool.config.delta * BigInt(pool.priceOffset)
    );
  }
  return null;
}
