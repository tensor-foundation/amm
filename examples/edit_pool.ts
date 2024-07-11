import {
  CurveType,
  EditPoolInput,
  PoolConfigArgs,
  PoolType,
  getEditPoolInstruction,
} from "@tensor-foundation/amm";
import {
  simulateTxWithIxs,
} from "@tensor-foundation/common-helpers";
import { rpc, keypairBytes } from "./common";
import { KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";

// edits given pool to new config
// if resetPriceOffset == true ==> will set pools start price to startingPrice field of newConfig
// if resetPriceOffset == false ==> pool will keep its priceOffset from new startingPrice
//
// example for resetPriceOffset: 
// Pool has startingPrice = 1 sol, poolType = Token, curveType = Linear, delta = 0.1 sol, CURRENT price is 0.8 sol, so pool.priceOffset = 2
// newConfig.startingPrice is now 0.5 sol, newConfig.curveType = Linear, newConfig.delta = 0.05 sol
// resetPriceOffset == true ==> edited pool will start at 0.5 sol (its startingPrice)
// resetPriceOffset == false ==> edited pool will start at 0.5 - (2 * 0.05) == 0.4 sol
export async function editPool(pool: string, newConfig: PoolConfigArgs, resetPriceOffset: boolean = true) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );
  const editPoolInput: EditPoolInput = {
    owner: keypairSigner,
    pool: address(pool),
    newConfig: newConfig,
    resetPriceOffset: resetPriceOffset,
  }

  // retrieve edit instruction
  const editPoolIx = getEditPoolInstruction(editPoolInput);
  await simulateTxWithIxs(rpc, [editPoolIx], keypairSigner);
}


editPool(
  // address of pool to edit
  "POOL_ADDRESS_HERE",
  // new config that the pool should be edited to
  {
    // PoolType.Token == bid-side only
    // PoolType.NFT == list-side only
    // PoolType.Trade == double-sided pool - relist bought NFTs, rebids on NFT sales according to mmFeeBps
    poolType: PoolType.Token,
    // Defines what price curve the pool should follow (exponential/linear)
    // depending on that, "delta" will define either constant price changes (linear)
    // or percentual price changes in BPS (exponential)
    curveType: CurveType.Linear,
    // Pools starting price in lamports (1 SOL == 1_000_000_000 Lamports)
    startingPrice: 1_000_000_000n,
    // if curveType == linear: defines price change in lamports after sale/bid got taken
    // if curveType == exponential: defines price change in BPS of current price after sale/bid got taken
    delta: 500_000_000n,
    // only has an effect if poolType == trade:
    // defines the buy-sell price gap in BPS
    mmFeeBps: null,
    // also only has an effect if poolType == trade:
    // defines whether profits (e.g. after 1+ successful bid/s and sale/s)
    // will go back into sol Vault or will stay seperate (boolean)
    mmCompoundFees: false,
  },
  // reset price offset? See above for explanation!
  true
);
