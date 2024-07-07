import { TENSOR_AMM_PROGRAM_ADDRESS, decodePool } from "@tensor-foundation/amm";
import { parseBase64RpcAccount } from "@solana/web3.js";
import { rpc } from "./common";
  
export async function getAllPoolsByOwner(owner: string) {
  // get all pool accounts (via dataSize) that match the given owner address 
  return await rpc.getProgramAccounts(TENSOR_AMM_PROGRAM_ADDRESS, 
    {
      encoding: "base64",
      filters: [
        {
          dataSize: 452n
        },
        { 
          //@ts-ignore: web3.js-next typing inaccuracy?
            memcmp: {
            bytes: owner,
            encoding: "base58",
            offset: 66n
         }
        }
      ]
  })
  .send()
  // parse and decode all received pool accounts
  .then(resp => {
    //@ts-ignore: web3.js-next typing inaccuracy?
    return resp.map(acc => {
      const parsedAcc = parseBase64RpcAccount(acc.pubkey, acc.account);
      return decodePool(parsedAcc);
    })
  })
}

