import {
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  Rpc,
} from '@solana/web3.js';
import { CurveType, Pool, PoolType, findPoolPda } from '../generated';
import { DEFAULT_ADDRESS } from './nullableAddress';

export function getCurrentAskPrice(pool: Pool): number | null {
  if (pool.nftsHeld < 1) return null;
  var askPrice = calculateCurrentPrice(pool, TakerSide.Buy);
  if (!askPrice) return null;
  return Math.ceil(askPrice);
}

export async function getCurrentBidPrice(
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>,
  pool: Pool
): Promise<number | null> {
  var bidPrice = calculateCurrentPrice(pool, TakerSide.Sell);
  if (!bidPrice || Math.floor(bidPrice) == 0) return null;
  bidPrice = Math.floor(bidPrice);
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
enum TakerSide {
  Buy,
  Sell,
}
// converting startingPrice to number, if any pool's starting price is higher
// than 9m sol (2^53-1 lamports) then feel free to blame me - leant
function calculateCurrentPrice(pool: Pool, side: TakerSide): number | null {
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
  const bps = 100_00;
  const tradePoolMult =
    pool.config.poolType === PoolType.Trade && side === TakerSide.Sell
      ? 1 - (pool.config.mmFeeBps ?? 0) / 100_00
      : 1;
  const offset = pool.priceOffset + tradePoolOffset;
  if (offset === 0) return Number(pool.config.startingPrice) * tradePoolMult;
  if (pool.config.curveType === CurveType.Exponential) {
    const base = BigInt(bps) + pool.config.delta;
    const exponent = BigInt(Math.abs(offset));
    const scaling = powerBigInt(base, exponent);
    return offset > 0
      ? (Number(pool.config.startingPrice) / scaling) * tradePoolMult
      : Number(pool.config.startingPrice) * scaling * tradePoolMult;
  } else if (pool.config.curveType === CurveType.Linear) {
    return (
      Number(pool.config.startingPrice - pool.config.delta * BigInt(offset)) *
      tradePoolMult
    );
  }
  return null;
}

function powerBigInt(base: bigint, exponent: bigint): number {
  // Calculate power for BigInt using exponentiation by squaring
  let result = 1n;
  let power = base;
  let originalExponent = exponent;
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result *= power;
    }
    power *= power;
    exponent /= 2n;
  }
  var zerosToGetRidOff = originalExponent * 4n;

  // start scaling down until MAX_SAFE_INTEGER
  while (result > Number.MAX_SAFE_INTEGER) {
    result / 10n;
    zerosToGetRidOff -= 1n;
  }
  // scaling down to a number, it _should_ be fine
  // to lose precision after the previous step
  return Number(result) / Number(10n ** zerosToGetRidOff);
}
