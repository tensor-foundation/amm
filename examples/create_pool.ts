import {
  CreatePoolAsyncInput,
  CurveType,
  PoolConfigArgs,
  PoolType,
  getCreatePoolInstructionAsync,
} from "@tensor-foundation/amm";
import {
  simulateTxWithIxs,
} from "@tensor-foundation/common-helpers";
import { rpc, keypairBytes } from "./common";
import { KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";

// constructs tx to create a Pool given its config and whitelist as parameters
export async function createPool(config: PoolConfigArgs, whitelist: string) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );
  const createPoolAsyncInput: CreatePoolAsyncInput = {
    owner: keypairSigner,
    whitelist: address(whitelist),
    config: config,
    // get maker broker fees of the price back to your own wallet
    // whenever your pool executes buys / sales
    makerBroker: keypairSigner.address,
  };

  // retrieve buy instruction
  const createPoolIx = await getCreatePoolInstructionAsync(createPoolAsyncInput);
  await simulateTxWithIxs(rpc, [createPoolIx], keypairSigner);
}


createPool({
  // PoolType.Token == bid-side only
  // PoolType.NFT == list-side only
  // PoolType.Trade == double-sided pool - relist bought NFTs, rebids on NFT sales according to mmFeeBps
  poolType: PoolType.Token,
  // Defines what price curve the pool should follow (exponential/linear)
  // depending on that, "delta" will define either a constant price change (linear)
  // or a percentual price change in BPS (exponential)
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
  "05c52d84-2e49-4ed9-a473-b43cab41e777"
);
