import {
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  Rpc,
} from '@solana/web3.js';
import {
  CurveType,
  Pool,
  PoolType,
  TakerSide,
  findPoolPda,
} from '../generated';
import { DEFAULT_ADDRESS } from './nullableAddress';

export function getCurrentAskPrice(
  pool: Pool,
  extraOffset: number = 0
): number | null {
  if (pool.nftsHeld < 1) return null;
  const askPrice = calculatePrice(pool, TakerSide.Buy, extraOffset);
  if (!askPrice) return null;
  return Math.ceil(askPrice);
}

export async function getCurrentBidPrice(
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>,
  pool: Pool,
  extraOffset: number = 0
): Promise<number | null> {
  let bidPrice = calculatePrice(pool, TakerSide.Sell, extraOffset);
  if (!bidPrice || Math.floor(bidPrice) == 0) return null;
  bidPrice = Math.floor(bidPrice);
  // No shared escrow, so we can just check if the pool has enough balance
  if (!pool.sharedEscrow || pool.sharedEscrow === DEFAULT_ADDRESS)
    return pool.amount >= bidPrice ? bidPrice : null;
  // Shared escrow, so we need to check if the escrow has enough balance
  const [poolAddress] = await findPoolPda({
    owner: pool.owner,
    poolId: pool.poolId,
  });
  const [escrowLamports, escrowDataLength] = await rpc
    .getAccountInfo(poolAddress, { encoding: 'base64' })
    .send()
    .then((resp) => {
      const dataLength = resp.value?.data
        ? Buffer.from(resp.value.data[0], 'base64').length
        : undefined;
      return [resp.value?.lamports, dataLength];
    });
  if (!escrowLamports || !escrowDataLength) return null;
  // Get the rent exemption for the escrow to ensure the available balance is enough
  const rentExemption = await rpc
    .getMinimumBalanceForRentExemption(BigInt(escrowDataLength))
    .send();
  return BigInt(escrowLamports) - rentExemption >= bidPrice ? bidPrice : null;
}

// converting startingPrice to number, if any pool's starting price is higher
// than 9m sol (2^53-1 lamports) then feel free to blame me - leant
function calculatePrice(
  pool: Pool,
  side: TakerSide,
  extraOffset: number = 0
): number | null {
  if (
    pool.config.poolType === PoolType.NFT ||
    (pool.priceOffset === pool.maxTakerSellCount &&
      pool.maxTakerSellCount !== 0 &&
      !!pool.sharedEscrow &&
      pool.sharedEscrow !== DEFAULT_ADDRESS)
  )
    return null;
  const tradePoolOffset =
    pool.config.poolType === PoolType.Trade && side === TakerSide.Sell ? 1 : 0;
  const offset = pool.priceOffset + tradePoolOffset + extraOffset;

  if (offset === 0) return Number(pool.config.startingPrice);

  const startingPrice = BigInt(pool.config.startingPrice);
  const delta = pool.config.delta;

  if (pool.config.curveType === CurveType.Exponential) {
    const base = 10000n + delta;
    const exponent = BigInt(Math.abs(offset));
    const scaling = powerBigInt(base, exponent);
    return Number(
      offset > 0
        ? (startingPrice * 10000n) / scaling
        : (startingPrice * scaling) / 10000n
    );
  } else if (pool.config.curveType === CurveType.Linear) {
    return Number(startingPrice - delta * BigInt(offset));
  }

  return null;
}

function powerBigInt(base: bigint, exponent: bigint): bigint {
  let result = 10000n;
  for (let i = 0n; i < exponent; i++) {
    result = (result * base) / 10000n;
  }
  return result;
}
