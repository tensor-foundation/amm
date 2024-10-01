import {
  GetAccountInfoApi,
  GetMinimumBalanceForRentExemptionApi,
  Rpc,
} from '@solana/web3.js';
import { CurveType, Pool, PoolType, TakerSide } from '../generated';
import { DEFAULT_ADDRESS } from './nullableAddress';

const BASIS_POINTS = 100_00n;
const BASIS_POINTS_DECIMAL_OFFSET = 4;
const BID_AMOUNT_LIMIT = 1000;

/**
 * Returns the amount of lamports needed for the given quantity of bids or
 * the amount of lamports the pool would receive if the given quantity of NFTs would sell
 * @param pool Pool or PoolConfig with priceOffset
 * @param quantity Amount of bids or listings (depending on @param side)
 * @param side TakerSide.Buy for Listings, TakerSide.Sell for Bids
 * @returns Amount of lamports needed
 */
export function calculateAmountForQuantity({
  pool,
  quantity,
  side,
}: {
  pool: Pick<Pool, 'config' | 'priceOffset'>;
  quantity: number;
  side: TakerSide;
}): number {
  if (quantity < 1) return 0;

  // Retrieve the amount of needed lamports for "quantity" amount of bids
  if (side === TakerSide.Sell) {
    if (pool.config.poolType === PoolType.NFT) return 0;

    // Trade pool that compounds fees ==> include mm fee (goes back into available balance)
    // Token pool / Trade pool that does not compound fees => exclude MM Fee
    const excludeMMFee =
      pool.config.poolType === PoolType.Trade && !pool.config.mmCompoundFees;

    if (pool.config.curveType === CurveType.Linear) {
      const currentPrice = calculatePrice({
        pool,
        side: TakerSide.Sell,
        royaltyFeeBps: 0,
        extraOffset: 0,
        excludeMMFee,
      });
      if (quantity === 1) return currentPrice;
      // override bidQuantity with max possible bid quantity or else needed amount of lamports will _decrease_
      // because of bids with negative lamports which aren't possible
      // if delta is 0, there are infinite max possible bids => to avoid div by 0 we just set it to "quantity"
      const maxPossibleBidsBeforeZero =
        pool.config.delta <= 0n
          ? quantity
          : 1 + Number(BigInt(currentPrice) / pool.config.delta);
      quantity = Math.min(quantity, maxPossibleBidsBeforeZero);

      const bases = currentPrice * quantity;
      const deltas =
        (Number(pool.config.delta) * (quantity * (quantity - 1))) / 2;
      return bases - deltas;
    }
    // exp
    else {
      // calculatePrice is fast enough that we can just iterate over next prices
      // instead of using geometric sum w/ potentially incorrect roundings
      let totalPrice = 0;
      let i = 0;
      while (quantity > 0) {
        totalPrice += calculatePrice({
          pool,
          side: TakerSide.Sell,
          royaltyFeeBps: 0,
          extraOffset: i,
          excludeMMFee,
        });
        quantity -= 1;
        if (totalPrice === 0) break;
        i += 1;
      }
      return totalPrice;
    }
  }
  // Retrieve the amount of lamports the pool/maker would receive after "quantity" amount of NFTs get bought out of the pool
  else {
    if (pool.config.poolType === PoolType.Token) return 0;
    let totalPrice = 0;
    let i = 0;
    while (quantity > 0) {
      totalPrice += calculatePrice({
        pool,
        side: TakerSide.Buy,
        royaltyFeeBps: 0,
        extraOffset: i,
        excludeMMFee: false,
      });
      quantity -= 1;
      i += 1;
    }
    return totalPrice;
  }
}

/**
 * Returns the amount of bids a pool or a pool config
 * can bid for given its available balance (MAX 1000)
 * @param pool Pool or PoolConfig with additional fields needed for maxTakerSellCount
 * @param availableLamports Amount of Lamports available to the pool
 * @returns Number of Bids (MAX 1000)
 */
export function getAmountOfBids({
  pool,
  availableLamports,
}: {
  pool: Pick<
    Pool,
    'config' | 'priceOffset' | 'maxTakerSellCount' | 'sharedEscrow'
  >;
  availableLamports: number | bigint;
}): number {
  if (pool.config.poolType === PoolType.NFT) return 0;

  let amountOfBidsWithoutMaxCount: number;
  // Trade pool that compounds fees ==> include mm fee (goes back into available balance)
  // Token pool / Trade pool that does not compound fees => exclude MM Fee
  const excludeMMFee =
    pool.config.poolType === PoolType.Trade && !pool.config.mmCompoundFees;

  if (pool.config.curveType === CurveType.Linear) {
    const currentPrice = calculatePrice({
      pool,
      side: TakerSide.Sell,
      royaltyFeeBps: 0,
      extraOffset: 0,
      excludeMMFee,
    });
    if (currentPrice < 0) return 0;
    let maxPossibleBidsBeforeZero =
      pool.config.delta <= 0n
        ? BID_AMOUNT_LIMIT
        : 1 + Number(BigInt(currentPrice) / pool.config.delta);
    maxPossibleBidsBeforeZero = Math.min(
      maxPossibleBidsBeforeZero,
      BID_AMOUNT_LIMIT
    );
    let bidCount = 0;
    let accumulatedPrice = 0n;
    while (
      accumulatedPrice < BigInt(availableLamports) &&
      bidCount < maxPossibleBidsBeforeZero + 1
    ) {
      const price = calculatePrice({
        pool,
        side: TakerSide.Sell,
        royaltyFeeBps: 0,
        extraOffset: bidCount,
        excludeMMFee,
      });
      accumulatedPrice += BigInt(price);
      bidCount += 1;
    }
    amountOfBidsWithoutMaxCount = Math.min(
      bidCount - 1,
      maxPossibleBidsBeforeZero
    );
  }
  // exponential
  else {
    // calculatePrice is fast enough that we can just iterate over next prices
    // instead of using geometric sum w/ potentially incorrect roundings
    let bidCount = 0;
    let accumulatedPrice = 0n;
    while (
      accumulatedPrice < BigInt(availableLamports) &&
      bidCount < BID_AMOUNT_LIMIT + 1
    ) {
      const price = calculatePrice({
        pool,
        side: TakerSide.Sell,
        royaltyFeeBps: 0,
        extraOffset: bidCount,
        excludeMMFee,
      });
      accumulatedPrice += BigInt(price);
      bidCount += 1;
    }
    amountOfBidsWithoutMaxCount = bidCount - 1;
  }
  return isMaxTakerSellCountReached(pool)
    ? Math.min(
        amountOfBidsWithoutMaxCount,
        pool.maxTakerSellCount + pool.priceOffset
      )
    : amountOfBidsWithoutMaxCount;
}
/**
 * Either returns the current ask price (price the pool currently sells its held NFTs for) or null (if the pool doesn't sell anymore)
 * @param pool Pool or PoolConfig with additional parameters
 * @param royaltyFeeBps Creator royalties in BPS
 * @param extraOffset Additional offset to calculate further prices (> 0)
 * @param excludeMMFee Whether to exclude the MM fee in the returned price
 * @returns Current Ask Price OR null
 */
export function getCurrentAskPrice({
  pool,
  royaltyFeeBps,
  extraOffset = 0,
  excludeMMFee = false,
}: {
  pool: Pick<
    Pool,
    'config' | 'nftsHeld' | 'priceOffset' | 'maxTakerSellCount' | 'sharedEscrow'
  >;
  royaltyFeeBps: number;
  extraOffset?: number;
  excludeMMFee?: boolean;
}): number | null {
  if (pool.nftsHeld < 1) return null;
  if (isNotFulfillable({ pool, side: TakerSide.Buy })) return null;
  return calculatePrice({
    pool,
    side: TakerSide.Buy,
    royaltyFeeBps,
    extraOffset,
    excludeMMFee,
  });
}
/**
 * Either returns the current bid price (price the pool bids for) or null if the pool does not bid anymore (e.g. if the pool does not have sufficient funds left)
 * @param pool Pool or PoolConfig with additional parameters
 * @param availableLamports Available Balance to the Pool
 * @param royaltyFeeBps Creator royalties in BPS
 * @param extraOffset Additional offset to calculate further prices (> 0)
 * @param excludeMMFee Whether to exclude the MM fee in the returned price
 * @returns Current Bid Price OR null
 */
export function getCurrentBidPriceSync({
  pool,
  availableLamports,
  royaltyFeeBps,
  extraOffset = 0,
  excludeMMFee = false,
}: {
  pool: Pick<
    Pool,
    'config' | 'priceOffset' | 'maxTakerSellCount' | 'sharedEscrow'
  >;
  availableLamports: number | bigint;
  royaltyFeeBps: number;
  extraOffset?: number;
  excludeMMFee?: boolean;
}): number | null {
  const bidPrice = calculatePrice({
    pool,
    side: TakerSide.Sell,
    royaltyFeeBps,
    extraOffset,
    excludeMMFee,
  });
  if (bidPrice < 1) return 0;
  if (isNotFulfillable({ pool, side: TakerSide.Sell })) return null;
  return availableLamports >= bidPrice ? bidPrice : null;
}
/**
 * Either returns the current bid price (price the pool bids for) or null if the pool does not bid anymore (e.g. if the pool does not have sufficient funds left).
 * Fetches the current escrow balance - account rent if needed via given RPC
 * @param rpc Rpc proxy instance
 * @param pool Pool or PoolConfig with additional parameters
 * @param royaltyFeeBps Creator royalties in BPS
 * @param extraOffset Additional offset to calculate further prices (> 0)
 * @param excludeMMFee Whether to exclude the MM fee in the returned price
 * @returns Current Bid Price OR null
 */
export async function getCurrentBidPrice({
  rpc,
  pool,
  royaltyFeeBps,
  extraOffset = 0,
  excludeMMFee = false,
}: {
  rpc: Rpc<GetAccountInfoApi & GetMinimumBalanceForRentExemptionApi>;
  pool: Pick<
    Pool,
    | 'config'
    | 'owner'
    | 'amount'
    | 'priceOffset'
    | 'maxTakerSellCount'
    | 'sharedEscrow'
  >;
  royaltyFeeBps: number;
  extraOffset?: number;
  excludeMMFee?: boolean;
}): Promise<number | null> {
  if (isNotFulfillable({ pool, side: TakerSide.Sell })) return null;
  const bidPrice = calculatePrice({
    pool,
    side: TakerSide.Sell,
    royaltyFeeBps,
    extraOffset,
    excludeMMFee,
  });
  if (bidPrice === null) return null;
  if (bidPrice < 1) return 0;
  // No shared escrow, so we can just check if the pool has enough balance
  if (!pool.sharedEscrow || pool.sharedEscrow === DEFAULT_ADDRESS)
    return pool.amount >= bidPrice ? bidPrice : null;
  // Shared escrow, so we need to check if the escrow has enough balance
  const [escrowLamports, escrowDataLength] = await rpc
    .getAccountInfo(pool.sharedEscrow, { encoding: 'base64' })
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
/**
 * Calculates the raw bid/ask price of a pool / pool config
 * @param pool Pool or PoolConfig with additional parameters
 * @param side TakerSide.Buy for getting Ask prices / TakerSide.Sell for getting Bid prices
 * @param royaltyFeeBps Creator royalties in BPS
 * @param extraOffset Additional offset to calculate further prices (> 0)
 * @param excludeMMFee Whether to exclude the MM fee in the returned price
 * @returns Resulting bid/ask price
 */
export function calculatePrice({
  pool,
  side,
  royaltyFeeBps,
  extraOffset = 0,
  excludeMMFee = false,
}: {
  pool: Pick<Pool, 'config' | 'priceOffset'>;
  side: TakerSide;
  royaltyFeeBps: number;
  extraOffset?: number;
  excludeMMFee?: boolean;
}): number {
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
    const base = BASIS_POINTS + delta;
    const exponent = BigInt(Math.abs(offset));
    const [scaling, decimalOffset] =
      powerBpsAsBigInt_12DecimalMantissaPrecision(base, exponent);
    let resultPriceIntermediate;
    if (offset < 0) {
      const divident = startingPrice * 10n ** decimalOffset;
      const divisor = scaling;
      resultPriceIntermediate =
        divident / divisor +
        BigInt(+needsRoundingAddedBack(divident, divisor, side));
    } else {
      const divident = startingPrice * scaling;
      const divisor = 10n ** decimalOffset;
      resultPriceIntermediate =
        divident / divisor +
        BigInt(+needsRoundingAddedBack(divident, divisor, side));
    }
    resultPrice = Number(resultPriceIntermediate);
  } else {
    resultPrice = Number(startingPrice + delta * BigInt(offset));
  }

  // account for mm fee for trade pools if not explicitly specified otherwise
  let resultPriceIncludingMmFees;
  if (pool.config.poolType === PoolType.Trade && !excludeMMFee) {
    const mmFees =
      (BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)) / BASIS_POINTS;
    resultPriceIncludingMmFees =
      side === TakerSide.Sell
        ? Number(BigInt(resultPrice) - mmFees)
        : Number(BigInt(resultPrice) + mmFees);
  } else {
    resultPriceIncludingMmFees = resultPrice;
  }

  // account for creator royalties
  let resultPriceIncludingMmFeesAndRoyalties;
  if (royaltyFeeBps === 0) return resultPriceIncludingMmFees;
  else {
    const royalties =
      (BigInt(resultPrice) * BigInt(royaltyFeeBps)) / BASIS_POINTS;
    resultPriceIncludingMmFeesAndRoyalties =
      side === TakerSide.Sell
        ? Number(BigInt(resultPriceIncludingMmFees) - royalties)
        : Number(BigInt(resultPriceIncludingMmFees) + royalties);
  }
  return resultPriceIncludingMmFeesAndRoyalties;
}
// Calculate power for BigInt using exponentiation by squaring
// with 12 mantissa decimal precision
function powerBpsAsBigInt_12DecimalMantissaPrecision(
  base: bigint,
  exponent: bigint
): [bigint, bigint] {
  let result;
  let decimalOffset = BASIS_POINTS_DECIMAL_OFFSET;
  let resultDecimalOffset = BASIS_POINTS_DECIMAL_OFFSET;
  if (exponent === 0n)
    return [1n * BASIS_POINTS, 1n * BigInt(BASIS_POINTS_DECIMAL_OFFSET)];
  if (exponent % 2n === 1n) {
    result = base;
  } else {
    result = 1n * BASIS_POINTS;
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

const needsRoundingAddedBack = (
  divident: bigint,
  divisor: bigint,
  side: TakerSide
): boolean => {
  const remainder = divident % divisor;
  return remainder > 0 && side === TakerSide.Buy;
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

function isMaxTakerSellCountReached(
  pool: Pick<Pool, 'priceOffset' | 'maxTakerSellCount' | 'sharedEscrow'>
): boolean {
  return (
    pool.priceOffset * -1 === pool.maxTakerSellCount &&
    pool.maxTakerSellCount !== 0 &&
    !!pool.sharedEscrow &&
    pool.sharedEscrow !== DEFAULT_ADDRESS
  );
}

const isNotFulfillable = ({
  pool,
  side,
}: {
  pool: Pick<
    Pool,
    'config' | 'priceOffset' | 'maxTakerSellCount' | 'sharedEscrow'
  >;
  side: TakerSide;
}) => {
  return (
    // can't sell into PoolType.NFT
    (pool.config.poolType === PoolType.NFT && side === TakerSide.Sell) ||
    // can't buy from a PoolType.Token
    (pool.config.poolType === PoolType.Token && side === TakerSide.Buy) ||
    // if maxTakerSellCount is reached when pool is attached to margin acc,
    // pool can't fulfill more bids
    (isMaxTakerSellCountReached(pool) && side === TakerSide.Sell)
  );
};
