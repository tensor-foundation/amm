import {
  PoolType,
  fetchPool,
  getCurrentAskPrice,
  BuyNftAsyncInput,
  getBuyNftInstructionAsync
} from "@tensor-foundation/amm";
import { KeyPairSigner, address, createKeyPairSignerFromBytes, isSome, Address, unwrapOption, parseBase64RpcAccount } from "@solana/web3.js";
import { TensorWhitelistAccount, decodeWhitelistV2, identifyTensorWhitelistAccount } from "@tensor-foundation/whitelist";
import { decodeWhitelist } from "@tensor-foundation/whitelist";
import { Mode } from "@tensor-foundation/whitelist";
import { rpc, keypairBytes } from "./common";
import { simulateTxWithIxs } from "@tensor-foundation/common-helpers";

// buys NFT, given its mint address, from pool, specified by its address
export async function buyNftFromPool(mint: string, poolAddress: string) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );

  // fetch pool
  const pool = await fetchPool(rpc, address(poolAddress));

  // check pools poolType to decide which instruction to call
  const poolType = pool.data.config.poolType;

  // poolType NFT would be a listing only pool, can't sell into that pool
  if (poolType === PoolType.Token) throw new Error(`Pool ${poolAddress} is a bid-side only pool and is not selling any NFTs.`);
  const { owner, whitelist } = pool.data;

  // check if whitelist is v1 or v2 (need whitelist to get FVC Address/es)
  // and retrieve corresponding creators if given from FVC field/s
  const whitelistData = await rpc
    .getAccountInfo(whitelist, { encoding: "base64" })
    .send()
    .then(resp => parseBase64RpcAccount(whitelist, resp.value));
  if (!whitelistData.exists) throw new Error("Whitelist Account doesn't exist anymore");
  const whitelistAccountType = identifyTensorWhitelistAccount(whitelistData);
  var isVerifiedViaFVC: boolean = false;
  var creators: Address[] = [];
  if (whitelistAccountType === TensorWhitelistAccount.Whitelist) {
    const decodedWhitelist = decodeWhitelist(whitelistData);
    isVerifiedViaFVC = isSome(decodedWhitelist.data.fvc);
    if (isVerifiedViaFVC) creators.push(unwrapOption(decodedWhitelist.data.fvc)!);
  }
  else if (whitelistAccountType == TensorWhitelistAccount.WhitelistV2) {
    const decodedWhitelistV2 = decodeWhitelistV2(whitelistData);
    isVerifiedViaFVC = !!decodedWhitelistV2.data.conditions.find((condition) => condition.mode === Mode.FVC);
    if (isVerifiedViaFVC) decodedWhitelistV2.data.conditions
      .filter((condition) => condition.mode === Mode.FVC)
      .forEach(condition => creators.push(condition.value));
  }
  else throw new Error(`${whitelist} is an unknown whitelist`)

  // get current price for buying out an NFT from the pool
  const maxAmount = getCurrentAskPrice(pool.data);
  if (!maxAmount) throw new Error(`Pool ${poolAddress} does not have any NFTs left.`);
  const buyNftAsyncInput: BuyNftAsyncInput = {
    owner: owner,
    buyer: keypairSigner,
    pool: address(poolAddress),
    mint: address(mint),
    maxAmount: maxAmount,
    creators: creators,
  };

  // retrieve buy instruction
  const buyIx = await getBuyNftInstructionAsync(buyNftAsyncInput);

  await simulateTxWithIxs(rpc, [buyIx], keypairSigner);
}

buyNftFromPool("NFT_MINT_ADDRESS_HERE", "POOL_ADDRESS_HERE");