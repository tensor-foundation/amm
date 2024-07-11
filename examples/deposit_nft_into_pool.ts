import {
  DepositNftAsyncInput,
  fetchPool,
  getDepositNftInstructionAsync,
} from "@tensor-foundation/amm";
import {
  simulateTxWithIxs,
} from "@tensor-foundation/common-helpers";
import { rpc, keypairBytes } from "./common";
import { KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";

// deposits NFT by given mint address into pool
export async function depositNft(pool: string, mint: string) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );
  // fetch whitelist from pool
  const whitelistAddress = await fetchPool(rpc, address(pool)).then(response => response.data.whitelist);

  const depositNftAsyncInput: DepositNftAsyncInput = {
    owner: keypairSigner,
    pool: address(pool),
    whitelist: whitelistAddress,
    mint: address(mint)
  }

  // retrieve deposit instruction
  const depositNftIx = await getDepositNftInstructionAsync(depositNftAsyncInput);
  await simulateTxWithIxs(rpc, [depositNftIx], keypairSigner);
}

depositNft("POOL_ADDRESS_HERE", "NFT_MINT_ADDRESS_HERE");