import {
  PoolType,
  SellNftTokenPoolAsyncInput,
  fetchPool,
  getCurrentBidPrice,
  SellNftTradePoolAsyncInput,
  getSellNftTokenPoolInstructionAsync,
  getSellNftTradePoolInstructionAsync
} from "@tensor-foundation/amm";
import { IInstruction, KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";

import { rpc, keypairBytes } from "./common";
import { fetchMetadata, simulateTxWithIxs } from "@tensor-foundation/common-helpers";
import { findMetadataPda } from "@tensor-foundation/resolvers";
  
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
  const { owner, whitelist, makerBroker, cosigner, sharedEscrow } = pool.data;

  if(cosigner) throw new Error(`Pool ${poolAddress} has a cosigner and requires a cosignature. Remove this line if you are in possession of the cosigners private key! :)`);

  // fetch metadata for additional relevant fields
  const [ metadataPda ] = await findMetadataPda({mint: address(mint)});
  const { tokenStandard, data: { creators:creatorsRaw }, programmableConfig } = await fetchMetadata(rpc, metadataPda);

  const creators = creatorsRaw.map(creator => creator.address);
  const ruleSet = programmableConfig?.ruleSet ?? undefined;

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
    // get taker broker fees of the price back to your own wallet!
    takerBroker: keypairSigner.address,
    sharedEscrow: sharedEscrow ?? undefined,
    authorizationRules: ruleSet,
    tokenStandard: tokenStandard,
    creators: creators,
  };

  // retrieve corresponding sell instruction depending on poolType
  if(poolType === PoolType.Token) sellIx = await getSellNftTokenPoolInstructionAsync(sellNftAsyncInput);
  else if(poolType === PoolType.Trade) sellIx = await getSellNftTradePoolInstructionAsync(sellNftAsyncInput);
  else throw new Error(`${poolType} is an unknown poolType`);

  await simulateTxWithIxs(rpc, [sellIx], keypairSigner);
}
  
sellNftIntoPool("NFT_MINT_ADDRESS_HERE", "POOL_ADDRESS_HERE");