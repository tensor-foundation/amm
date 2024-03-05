import test from 'ava';
import { MyAccount, fetchMyAccount, getCreateInstruction } from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  signAndSendTransaction,
} from './_setup';
import { appendTransactionInstruction } from '@solana/transactions';
import { pipe } from '@solana/web3.js';
import { generateKeyPairSigner } from '@solana/signers';

test('it can create new accounts', async (t) => {
  // Given a client and a new signer.
  const client = createDefaultSolanaClient();
  const account = await generateKeyPairSigner();
  const payer = await generateKeyPairSignerWithSol(client);

  // When we create a new account.
  const createIx = getCreateInstruction({
    address: account,
    authority: payer.address,
    payer,
    arg1: 1,
    arg2: 2,
  });

  await pipe(
    await createDefaultTransaction(client, payer.address),
    (tx) => appendTransactionInstruction(createIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then an account was created with the correct data.
  t.like(await fetchMyAccount(client.rpc, account.address), <MyAccount>{
    address: account.address,
    data: {
      authority: payer.address,
      data: { field1: 1, field2: 2 },
    },
  });
});
