import {
  PoolType,
  fetchPool,
  getCurrentAskPrice,
  BuyNftAsyncInput,
  getBuyNftInstructionAsync
} from "@tensor-foundation/amm";
import { KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";
import { rpc, keypairBytes } from "./common";
import { simulateTxWithIxs, fetchMetadata } from "@tensor-foundation/common-helpers";
import { findMetadataPda } from "@tensor-foundation/resolvers";

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
  const { owner, makerBroker, cosigner, sharedEscrow } = pool.data;

  if(cosigner) throw new Error(`Pool ${poolAddress} has a cosigner and requires a cosignature. Remove this line if you are in possession of the cosigners private key! :)`);

  // fetch metadata for additional relevant fields
  const [ metadataPda ] = await findMetadataPda({mint: address(mint)});
  const { tokenStandard, data: { creators:creatorsRaw }, programmableConfig } = await fetchMetadata(rpc, metadataPda);

  const creators = creatorsRaw.map(creator => creator.address);
  const ruleSet = programmableConfig?.ruleSet ?? undefined;

  // get current price for buying out an NFT from the pool
  const maxAmount = getCurrentAskPrice(pool.data);
  if (!maxAmount) throw new Error(`Pool ${poolAddress} does not have any NFTs left.`);
  const buyNftAsyncInput: BuyNftAsyncInput = {
    owner: owner,
    buyer: keypairSigner,
    pool: address(poolAddress),
    mint: address(mint),
    maxAmount: maxAmount,
    makerBroker: makerBroker ?? undefined,
    // get taker broker fees of the price back to your own wallet!
    takerBroker: keypairSigner.address,
    sharedEscrow: sharedEscrow ?? undefined,
    authorizationRules: ruleSet,
    tokenStandard: tokenStandard,
    creators: creators,
  };

  // retrieve buy instruction
  const buyIx = await getBuyNftInstructionAsync(buyNftAsyncInput);

  await simulateTxWithIxs(rpc, [buyIx], keypairSigner);
}

buyNftFromPool("NFT_MINT_ADDRESS_HERE", "POOL_ADDRESS_HERE");