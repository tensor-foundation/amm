import {
  DepositSolInput,
  getDepositSolInstruction,
} from "@tensor-foundation/amm";
import {
  simulateTxWithIxs,
} from "@tensor-foundation/common-helpers";
import { rpc, keypairBytes } from "./common";
import { KeyPairSigner, address, createKeyPairSignerFromBytes } from "@solana/web3.js";

// deposits sol into pool, amount specified by lamports ( 1 sol == 1_000_000_000 lamports )
export async function depositSol(pool: string, lamports: number) {
  const keypairSigner: KeyPairSigner = await createKeyPairSignerFromBytes(
    Buffer.from(keypairBytes),
    false,
  );

  const depositSolInput: DepositSolInput = {
    owner: keypairSigner,
    pool: address(pool),
    lamports: lamports
  }

  // retrieve deposit instruction
  const depositSolIx = getDepositSolInstruction(depositSolInput);
  await simulateTxWithIxs(rpc, [depositSolIx], keypairSigner);
}

await depositSol("POOL_ADDRESS_HERE", 1_000_000_000);