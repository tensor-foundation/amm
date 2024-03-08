// import test from 'ava';
// import { Pool, fetchMyAccount, getCreatePoolInstruction } from '../src';
// import {
//   createDefaultSolanaClient,
//   createDefaultTransaction,
//   generateKeyPairSignerWithSol,
//   signAndSendTransaction,
// } from './_setup';
// import { appendTransactionInstruction } from '@solana/transactions';
// import { pipe } from '@solana/web3.js';
// import { generateKeyPairSigner } from '@solana/signers';

// test('it can create new accounts', async (t) => {
//   // Given a client and a new signer.
//   const client = createDefaultSolanaClient();
//   const owner = await generateKeyPairSigner();
//   const cosigner = await generateKeyPairSigner();
//   const payer = await generateKeyPairSignerWithSol(client);

//   // When we create a new account.
//   const createPoolIx = getCreatePoolInstruction({
//     owner,
//     pool: account,
//     solEscrow: solEscrow,
//     whitelist,
//     identifier,
//     config,
//     isCosigned: false,
//     orderType: 0,
//   });

//   await pipe(
//     await createDefaultTransaction(client, payer.address),
//     (tx) => appendTransactionInstruction(createIx, tx),
//     (tx) => signAndSendTransaction(client, tx)
//   );

//   // Then an account was created with the correct data.
//   t.like(await fetchMyAccount(client.rpc, account.address), <Pool>{
//     address: account.address,
//     data: {
//       authority: payer.address,
//       data: { field1: 1, field2: 2 },
//     },
//   });
// });
