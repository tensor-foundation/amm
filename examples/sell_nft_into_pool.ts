import {
  PoolType,
  SellNftTokenPoolAsyncInput,
  fetchPool,
  getCurrentBidPrice,
  SellNftTradePoolAsyncInput,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync
} from "@tensor-foundation/amm";
import { IInstruction, KeyPairSigner, address, createKeyPairSignerFromBytes, isSome, Address, unwrapOption, parseBase64RpcAccount, EncodedAccount } from "@solana/web3.js";
import { TensorWhitelistAccount, decodeWhitelistV2, identifyTensorWhitelistAccount } from "@tensor-foundation/whitelist";
import { decodeWhitelist } from "@tensor-foundation/whitelist";
import { Mode } from "@tensor-foundation/whitelist";
import { rpc, keypairBytes } from "./common";
import { simulateTxWithIxs } from "@tensor-foundation/common-helpers";
  
// sells NFT, given its mint address, into pool, specified by its address
export async function sellNftIntoPool(mint: string, poolAddress: string) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );

  // fetch pool
  const pool = await fetchPool(rpc, address(poolAddress));

  // check pools poolType to decide which instruction to call
  const poolType = pool.data.config.poolType;

  // poolType NFT would be a listing only pool, can't sell into that pool
  if(poolType === PoolType.NFT) throw new Error(`Pool ${poolAddress} is a sell-side only pool and is not bidding.`);

  // get overlapping arguments for trade / token pools
  var sellIx: IInstruction;
  const { owner, whitelist, makerBroker } = pool.data;

  // check if whitelist is v1 or v2 
  // and retrieve creators if given
  const whitelistData = await rpc
    .getAccountInfo(whitelist, {encoding: "base64"})
    .send()
    .then(resp => parseBase64RpcAccount(whitelist, resp.value));
  if(!whitelistData.exists) throw new Error("Whitelist Account doesn't exist anymore");
  const whitelistAccountType = identifyTensorWhitelistAccount(whitelistData);
  var isVerifiedViaFVC: boolean = false;
  var creators: Address[] = [];
  if(whitelistAccountType === TensorWhitelistAccount.Whitelist) {
    const decodedWhitelist = decodeWhitelist(whitelistData);
    isVerifiedViaFVC = isSome(decodedWhitelist.data.fvc);
    if(isVerifiedViaFVC) creators.push(unwrapOption(decodedWhitelist.data.fvc)!);
  }
  else if(whitelistAccountType == TensorWhitelistAccount.WhitelistV2) {
    const decodedWhitelistV2 = decodeWhitelistV2(whitelistData);
    isVerifiedViaFVC = !!decodedWhitelistV2.data.conditions.find((condition) => condition.mode === Mode.FVC);
    if(isVerifiedViaFVC) decodedWhitelistV2.data.conditions
    .filter((condition) => condition.mode === Mode.FVC)
    .forEach(condition => creators.push(condition.value));
  }
  else throw new Error(`${whitelist} is an unknown whitelist`)

  // fetch current bid price of the pool
  const minPrice = await getCurrentBidPrice(rpc, pool.data);
  if(!minPrice) throw new Error(`Pool ${poolAddress} does not have enough funds left.`);
  const sellNftAsyncInput: SellNftTokenPoolAsyncInput | SellNftTradePoolAsyncInput = {
    owner: owner,
    whitelist: whitelist,
    seller: keypairSigner,
    pool: address(poolAddress),
    mint: address(mint),
    minPrice: minPrice,
    makerBroker: makerBroker ?? undefined,
    creators: creators,
  };

  // retrieve corresponding sell instruction depending on poolType
  if(poolType === PoolType.Token) sellIx = await getSellNftTokenPoolInstructionAsync(sellNftAsyncInput);
  else if(poolType === PoolType.Trade) sellIx = await getSellNftTradePoolInstructionAsync(sellNftAsyncInput);
  else throw new Error(`${poolType} is an unknown poolType`);

  await simulateTxWithIxs(rpc, [sellIx], keypairSigner);
}
  
sellNftIntoPool("NFT_MINT_ADDRESS_HERE", "POOL_ADDRESS_HERE");