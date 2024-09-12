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
  return askPrice
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
    // can't sell into PoolType.NFT
    (pool.config.poolType === PoolType.NFT && side === TakerSide.Sell) ||
    // can't buy from a PoolType.Token
    (pool.config.poolType === PoolType.Token && side === TakerSide.Buy) ||
    // if maxTakerSellCount is reached when pool is attached to margin acc,
    // pool can't fulfill more bids
    (pool.priceOffset === pool.maxTakerSellCount &&
      pool.maxTakerSellCount !== 0 &&
      !!pool.sharedEscrow &&
      pool.sharedEscrow !== DEFAULT_ADDRESS)
  )
    return null;

  // prevents input var misunderstanding (thinking that extraOffset needs to be negative for TakerSide.Buy)
  const extraOffsetNormalized = Math.abs(extraOffset);

  // trade pool has an extra offset on the sell side
  const tradePoolOffset =
    pool.config.poolType === PoolType.Trade && side === TakerSide.Sell ? -1 : 0;
  const offset =
    pool.priceOffset +
    tradePoolOffset +
    (side === TakerSide.Sell ? -extraOffsetNormalized : extraOffsetNormalized);
  const startingPrice = pool.config.startingPrice;
  const delta = pool.config.delta;
  let resultPrice: number;

  // exponential: currentPrice = startingPrice * (1+delta)^offset
  // here scaled to U256 accuracy via bigints + adding back
  // missing rounding that bigint's can't do (e.g. 16n / 10n === 1)
  // but on-chain the price gets rounded float-esque => int
  if (pool.config.curveType === CurveType.Exponential) {
    const base = 100_00n + delta;
    const exponent = BigInt(Math.abs(offset));
    const [scaling, decimalOffset] = powerBigIntBySquaring_U256Precision(
      base,
      exponent
    );
    console.log(`scaling, decimalOffset: ${scaling}, ${decimalOffset}`)
    let resultPriceIntermediate;
    if (offset < 0) {
      const divident = startingPrice * 10n ** decimalOffset;
      const divisor = scaling;
      resultPriceIntermediate =
        divident / divisor + BigInt(+needsRoundingAddedBack(divident, divisor));
    } else {
      const divident = startingPrice * scaling;
      const divisor = 10n ** decimalOffset;
      resultPriceIntermediate =
        divident / divisor + BigInt(+needsRoundingAddedBack(divident, divisor));
        console.log(`divident: ${divident}, divisor: ${divisor}, result: ${resultPriceIntermediate}`)

    }
    resultPrice = Number(resultPriceIntermediate);
  } else {
    resultPrice = Number(startingPrice + delta * BigInt(offset));
  }
  // subtract mm fee for trade pools on the sell side if wanted
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
// Calculate power for BigInt using exponentiation by squaring
// with 256 bit precision
function powerBigIntBySquaring_U256Precision(
  base: bigint,
  exponent: bigint
): [bigint, bigint] {
  if(exponent === 0n) return [100_00n, 4n];
  let decimalOffset2 = 4;
  let power = base;
  let runningExponent = 1n;
  while (runningExponent < exponent) {
    if ((exponent / runningExponent) % 2n === 1n) {
      power *= base; 
      decimalOffset2 += 4;
      [power, decimalOffset2] = cutTo12MantissaDecimals(power, decimalOffset2);
      runningExponent += 1n;
      if (runningExponent === exponent) break;
    }
    else {
      power *= power;
      decimalOffset2 *= 2;
      [power, decimalOffset2] = cutTo12MantissaDecimals(power, decimalOffset2);

      runningExponent *= 2n;
    }
  }
  return [power, BigInt(decimalOffset2)];
}

// checks if bigint division would have gotten rounded up if floating division would've been applied instead
// i.e.: a / b = c with c == e.m ==> m >= 0.5?
// equivalent to a % b = r ==> b - r >= r ?
const needsRoundingAddedBack = (divident: bigint, divisor: bigint): boolean => {
  const remainder = divident % divisor;
  return divisor - remainder <= remainder;
};

// returns next upper 10^x and x for a given amount of bits exceeding the precision limit
//const findDecimalPrecisionLossFromBinary = (
//  precisionLossBits: number
//): [bigint, number] => {
//  const maxLossDecimal = 2n ** BigInt(precisionLossBits);
//  if (maxLossDecimal <= 0) return [1n, 0];
//  const exponent = maxLossDecimal.toString(10).length - 1;
//  return [10n ** BigInt(exponent), exponent];
//};

//function cutTo256Bits(result: bigint): [bigint, number] {
//  const precisionLossBits = Math.max(result.toString(2).length - 256, 0);
//  return precisionLossBits > 0
//    ? findDecimalPrecisionLossFromBinary(precisionLossBits)
//    : [1n, 0];
//}

const cutTo12MantissaDecimals = (num: bigint, decimalOffset: number, withRounding: boolean = true): [bigint, number] => {
  const decimalPrecision = 12;
  const exponentLength = num.toString(10).length - decimalOffset;
  let adjustedNum = decimalOffset > decimalPrecision ? BigInt(num.toString(10).slice(0, (exponentLength + decimalPrecision))) : num;
  const adjustedOffset = adjustedNum.toString(10).length - exponentLength;
  adjustedNum += withRounding ? BigInt(+(parseInt(num.toString()[decimalPrecision + 1]) > 4)) : 0n;
  return [adjustedNum, adjustedOffset];
}
