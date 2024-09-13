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

// returns a maximum of 1000
export function getAmountOfBids(
  pool: Pool,
  availableLamports: number | bigint
): number {
  if (pool.config.poolType === PoolType.NFT) return 0;

  let amountOfBidsWithoutMaxCount: number;
  // Trade pool that compounds fees ==> disregard mmFee since they go right back into availableLamports
  let excludeMMFee =
    pool.config.poolType === PoolType.Trade && !!pool.config.mmCompoundFees;

  if (pool.config.curveType === CurveType.Linear) {
    const currentPrice = calculatePrice(pool, TakerSide.Sell, 0, excludeMMFee);
    if (!currentPrice) return 0;
    amountOfBidsWithoutMaxCount =
      1 + Number(BigInt(currentPrice) / pool.config.delta);
  }
  // exponential
  else {
    // calculatePrice is fast enough that we can just iterate over next prices
    // instead of using geometric sum w/ potentially incorrect roundings
    let bidCount = 0;
    let accumulatedPrice = 0n;
    while (accumulatedPrice <= BigInt(availableLamports) && bidCount < 1000) {
      let price = calculatePrice(pool, TakerSide.Sell, bidCount, excludeMMFee);
      if (!price) {
        break;
      }
      accumulatedPrice += BigInt(price);
      bidCount += 1;
    }
    amountOfBidsWithoutMaxCount = bidCount;
  }
  return isMaxTakerSellCountApplicable(pool)
    ? Math.max(amountOfBidsWithoutMaxCount, pool.maxTakerSellCount)
    : amountOfBidsWithoutMaxCount;
}

export function getCurrentAskPrice(
  pool: Pool,
  extraOffset: number = 0,
  excludeMMFee: boolean = true
): number | null {
  if (pool.nftsHeld < 1) return null;
  return calculatePrice(pool, TakerSide.Buy, extraOffset, excludeMMFee);
}

export function getCurrentBidPriceSync(
  pool: Pool,
  availableLamports: number | bigint,
  extraOffset: number = 0,
  excludeMMFee: boolean = false
): number | null {
  const bidPrice = calculatePrice(
    pool,
    TakerSide.Sell,
    extraOffset,
    excludeMMFee
  );
  if (bidPrice === null) return null;
  if (bidPrice < 1) return 0;
  return availableLamports >= bidPrice ? bidPrice : null;
}

export async function getCurrentBidPrice(
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>,
  pool: Pool,
  extraOffset: number = 0,
  excludeMMFee: boolean = false
): Promise<number | null> {
  const bidPrice = calculatePrice(
    pool,
    TakerSide.Sell,
    extraOffset,
    excludeMMFee
  );
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

export function calculatePrice(
  pool: Pool,
  side: TakerSide,
  extraOffset: number = 0,
  excludeMMFee: boolean = false
): number | null {
  if (
    // can't sell into PoolType.NFT
    (pool.config.poolType === PoolType.NFT && side === TakerSide.Sell) ||
    // can't buy from a PoolType.Token
    (pool.config.poolType === PoolType.Token && side === TakerSide.Buy) ||
    // if maxTakerSellCount is reached when pool is attached to margin acc,
    // pool can't fulfill more bids
    (isMaxTakerSellCountApplicable(pool) && side === TakerSide.Sell)
  )
    return null;

  // prevents input var misunderstanding (thinking that extraOffset needs to be negative for TakerSide.Sell)
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
  // here scaled to 12 Mantissa decimal accuracy via bigints + adding back
  // missing rounding that bigint's can't do (e.g. 16n / 10n === 1)
  // but on-chain the price gets rounded float-esque => int
  if (pool.config.curveType === CurveType.Exponential) {
    const base = 100_00n + delta;
    const exponent = BigInt(Math.abs(offset));
    const [scaling, decimalOffset] =
      powerBpsAsBigInt_12DecimalMantissaPrecision(base, exponent);
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
    }
    resultPrice = Number(resultPriceIntermediate);
  } else {
    resultPrice = Number(startingPrice + delta * BigInt(offset));
  }
  // subtract mm fee for trade pools on the sell side if wanted
  if (
    pool.config.poolType === PoolType.Trade &&
    side === TakerSide.Sell &&
    !excludeMMFee
  ) {
    resultPrice = Number(
      BigInt(resultPrice) -
        (BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)) / 100_00n
    );
  }
  return resultPrice;
}
// Calculate power for BigInt using exponentiation by squaring
// with 12 mantissa decimal precision
function powerBpsAsBigInt_12DecimalMantissaPrecision(
  base: bigint,
  exponent: bigint
): [bigint, bigint] {
  let result;
  let decimalOffset = 4;
  let resultDecimalOffset = 4;
  if (exponent === 0n) return [100_00n, 4n];
  if (exponent % 2n === 1n) {
    result = base;
  } else {
    result = 100_00n;
  }
  let pow = base;
  exponent /= 2n;
  while (exponent > 0n) {
    pow *= pow;
    decimalOffset *= 2;
    [pow, decimalOffset] = cutTo12MantissaDecimals(pow, decimalOffset);
    if (exponent % 2n === 1n) {
      result *= pow;
      resultDecimalOffset += decimalOffset;
      [result, resultDecimalOffset] = cutTo12MantissaDecimals(
        result,
        resultDecimalOffset
      );
    }
    exponent /= 2n;
  }
  [result, resultDecimalOffset] = cutTo12MantissaDecimals(
    result,
    resultDecimalOffset
  );

  return [result, BigInt(resultDecimalOffset)];
}

// checks if bigint division would have gotten rounded up if floating division would've been applied instead
// i.e.: a / b = c with c == e.m ==> m >= 0.5?
// equivalent to a % b = r ==> b - r >= r ?
const needsRoundingAddedBack = (divident: bigint, divisor: bigint): boolean => {
  const remainder = divident % divisor;
  return divisor - remainder <= remainder;
};

const cutTo12MantissaDecimals = (
  num: bigint,
  decimalOffset: number,
  withRounding: boolean = true
): [bigint, number] => {
  const decimalPrecision = 12;
  const exponentLength = num.toString(10).length - decimalOffset;
  let adjustedOffset = decimalOffset;
  let adjustedNum = num;
  if (decimalOffset > decimalPrecision) {
    adjustedNum = BigInt(
      num.toString(10).slice(0, exponentLength + decimalPrecision)
    );
    adjustedOffset = adjustedNum.toString(10).length - exponentLength;
  }
  adjustedNum += withRounding
    ? BigInt(+(parseInt(num.toString()[decimalPrecision + 1]) > 4))
    : 0n;
  return [adjustedNum, adjustedOffset];
};

function isMaxTakerSellCountApplicable(pool: Pool): boolean {
  return (
    pool.priceOffset * -1 === pool.maxTakerSellCount &&
    pool.maxTakerSellCount !== 0 &&
    !!pool.sharedEscrow &&
    pool.sharedEscrow !== DEFAULT_ADDRESS
  );
}
