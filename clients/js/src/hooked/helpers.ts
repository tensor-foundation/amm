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
  extraOffset: number = 0,
  isTaker: boolean = true
): number | null {
  if (pool.nftsHeld < 1) return null;
  const askPrice = calculatePrice(pool, TakerSide.Buy, extraOffset, isTaker);
  if (!askPrice) return null;
  return Math.ceil(askPrice);
}

export async function getCurrentBidPrice(
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>,
  pool: Pool,
  extraOffset: number = 0,
  isTaker: boolean = true
): Promise<number | null> {
  let bidPrice = calculatePrice(pool, TakerSide.Sell, extraOffset, isTaker);
  if (bidPrice === null) return null;
  if (bidPrice < 1) return 0;
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

function calculatePrice(
  pool: Pool,
  side: TakerSide,
  extraOffset: number = 0,
  isTaker: boolean = true
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
    pool.config.poolType === PoolType.Trade && side === TakerSide.Sell ? -1 : 0;
  const offset =
    pool.priceOffset +
    tradePoolOffset +
    (side === TakerSide.Sell ? -extraOffset : extraOffset);
  const startingPrice = pool.config.startingPrice;
  const delta = pool.config.delta;
  let resultPrice: number;

  if (pool.config.curveType === CurveType.Exponential) {
    const base = 100_00n + delta;
    const exponent = BigInt(Math.abs(offset));
    const [scaling, decimalOffset] = powerBigInt_U256Precision(base, exponent);
    let resultPriceIntermediate;
    if (offset <= 0) {
      const divident = startingPrice * 10n ** decimalOffset;
      const divisor = scaling;
      resultPriceIntermediate =
        divident / divisor + BigInt(+needsRoundingAddedBack(divident, divisor));
    } else {
      const divident = startingPrice * scaling;
      const divisor = 10n ** decimalOffset;
      resultPriceIntermediate =
        divident / divisor + BigInt(+needsRoundingAddedBack(divident, divisor));
    }
    resultPrice = Number(resultPriceIntermediate);
  } else {
    resultPrice = Number(startingPrice + delta * BigInt(offset));
  }
  if (
    pool.config.poolType === PoolType.Trade &&
    side === TakerSide.Sell &&
    isTaker
  ) {
    resultPrice = Number(
      BigInt(resultPrice) -
        (BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)) / 100_00n
    );
  }
  return resultPrice;
}

function powerBigInt_U256Precision(
  base: bigint,
  exponent: bigint
): [bigint, bigint] {
  const U256_MAX = 2n ** 255n - 1n;
  let result = 1n;
  let decimalOffset = 0n;
  let additionalPrecisionLoss = 0;

  for (let i = 0n; i < exponent; i++) {
    result = result * base;
    if (result > U256_MAX) {
      const precisionLossBits = result.toString(2).length - 255;
      const [divisor, decimalPrecisionLoss] =
        findDecimalPrecisionLossFromBinary(precisionLossBits);
      result /= divisor;
      additionalPrecisionLoss += decimalPrecisionLoss;
    }
    decimalOffset += 4n;
  }
  return [result, decimalOffset - BigInt(additionalPrecisionLoss)];
}

// checks if bigint division would have gotten rounded up if floating division would've been applied instead
// i.e.: a / b = c with c == e.m ==> m >= 0.5?
// equivalent to a % b = r, r < b - r ?
const needsRoundingAddedBack = (divident: bigint, divisor: bigint): boolean => {
  return divisor - (divident % divisor) <= divident % divisor;
};

// returns nearest 10^x and x for a given amount of bits exceeding the precision limit
const findDecimalPrecisionLossFromBinary = (
  precisionLossBits: number
): [bigint, number] => {
  const maxLossDecimal = 2 ** precisionLossBits;
  if (maxLossDecimal <= 0) return [1n, 0];
  const exponent = Math.ceil(Math.log10(maxLossDecimal));
  return [10n ** BigInt(exponent), exponent];
};
