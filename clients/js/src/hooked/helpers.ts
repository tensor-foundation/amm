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
    pool.config.poolType === PoolType.Trade && side === TakerSide.Sell ? -1 : 0;
  const offset =
    pool.priceOffset +
    tradePoolOffset +
    (side === TakerSide.Sell ? -extraOffset : extraOffset);
  console.log(
    `pool offset: ${pool.priceOffset}, tradePoolOffset: ${tradePoolOffset}, extraOffset: ${side === TakerSide.Sell ? -extraOffset : extraOffset}`
  );
  const startingPrice = BigInt(pool.config.startingPrice);
  const delta = pool.config.delta;
  let resultPrice: number;

  if (pool.config.curveType === CurveType.Exponential) {
    const base = 100_00n + delta;
    const exponent = BigInt(Math.abs(offset));
    const [scaling, zerosToGetRidOff] = powerBigInt(base, exponent);
    const resultPriceIntermediate =
      offset <= 0
        ? (startingPrice * 10n ** zerosToGetRidOff) / scaling
        : (startingPrice * scaling) / 10n ** zerosToGetRidOff;
    // get rid of precision now
    resultPrice = Number(resultPriceIntermediate);
    console.log(
      `base: ${base}, exponent: ${exponent}, scaling: ${scaling}, intermediate: ${resultPriceIntermediate}, numGetRid: ${zerosToGetRidOff}, resultPrice: ${resultPrice}`
    );
  } else {
    resultPrice = Number(startingPrice + delta * BigInt(offset));
    console.log(
      `startingPrice: ${startingPrice}, delta: ${delta}, delta*offset: ${delta * BigInt(offset)}`
    );
  }
  if (pool.config.poolType === PoolType.Trade && side === TakerSide.Sell) {
    console.log(
      `minus mmFee: ${(BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)) / 100_00n}`
    );
    console.log(
      `mmFeeBps: ${BigInt(pool.config.mmFeeBps ?? 0)}, resultPrice * mmFeeBps: ${BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)}`
    );
    resultPrice = Number(
      BigInt(resultPrice) -
        (BigInt(resultPrice) * BigInt(pool.config.mmFeeBps ?? 0)) / 100_00n
    );
  }
  return resultPrice;
}

//function powerBigIntBps(base: bigint, exponent: bigint): bigint {
//  if(exponent === 0n) return 100_00n;
//  if(exponent === 1n) return base;
//  let result = 100_00n;
//  for (let i = 0n; i < exponent; i++) {
//    result = (result * base) / 100_00n;
//  }
//  return result;
//}

function powerBigInt(base: bigint, exponent: bigint): [bigint, bigint] {
  const U256_MAX = 2n ** 256n - 1n;
  let result = 1n;
  let power = base;
  let zerosToGetRidOff = 0n;
  let precisionLoss = 0n;
  const originalExponent = exponent;

  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      let newResult = result * power;
      if (newResult > U256_MAX) {
        precisionLoss += BigInt(newResult.toString(2).length - 256);
        newResult %= U256_MAX + 1n;
      }
      result = newResult;
    }
    let newPower = power * power;
    if (newPower > U256_MAX) {
      precisionLoss += BigInt(newPower.toString(2).length - 256);
      newPower %= U256_MAX + 1n;
    }
    power = newPower;
    exponent /= 2n;
  }

  zerosToGetRidOff = originalExponent * 4n - precisionLoss;

  return [result, zerosToGetRidOff];
}
