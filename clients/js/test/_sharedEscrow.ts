import '@solana/webcrypto-ed25519-polyfill';
import { ExecutionContext } from 'ava';
import {
  Address,
  pipe,
  appendTransactionInstruction,
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
} from '@solana/web3.js';
import { KeyPairSigner } from '@solana/signers';
import {
  Client,
  createDefaultTransaction,
  signAndSendTransaction,
} from '@tensor-foundation/test-helpers';
import {
  findSharedEscrowPda,
  getInitSharedEscrowAccountInstruction,
} from '../src/index.js';

export interface InitSharedEscrowParams {
  client: Client;
  owner: KeyPairSigner;
  name?: Uint8Array;
  sharedEscrowNr?: number;
}

export interface InitSharedEscrowThrowsParams extends InitSharedEscrowParams {
  t: ExecutionContext;
  code: number;
}

export interface InitSharedEscrowReturns {
  owner: KeyPairSigner;
  sharedEscrow: Address;
  name: Uint8Array;
  sharedEscrowNr: number;
}

export async function initSharedEscrow({
  client,
  owner,
  name = new Uint8Array(32).fill(1),
  sharedEscrowNr = 0,
}: InitSharedEscrowParams): Promise<InitSharedEscrowReturns> {
  const [sharedEscrow] = await findSharedEscrowPda({
    owner: owner.address,
    nr: sharedEscrowNr,
  });

  // Create a shared escrow
  const initSharedEscrowIx = getInitSharedEscrowAccountInstruction({
    owner,
    sharedEscrow,
    sharedEscrowNr,
    name,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(initSharedEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  return { owner, sharedEscrow, name, sharedEscrowNr };
}

export async function initSharedEscrowThrows({
  client,
  owner,
  name = new Uint8Array(32).fill(1),
  sharedEscrowNr = 0,
  t,
  code,
}: InitSharedEscrowThrowsParams) {
  const [sharedEscrow] = await findSharedEscrowPda({
    owner: owner.address,
    nr: sharedEscrowNr,
  });

  // Create a shared escrow
  const initSharedEscrowIx = getInitSharedEscrowAccountInstruction({
    owner,
    sharedEscrow,
    sharedEscrowNr,
    name,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(initSharedEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const promise = pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(initSharedEscrowIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  const error = await t.throwsAsync<Error & { data: { logs: string[] } }>(
    promise
  );

  if (isSolanaError(error.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    t.assert(
      error.cause.context.code === code,
      `expected error code ${code}, received ${error.cause.context.code}`
    );
  } else {
    t.fail("expected a custom error, but didn't get one");
  }
}
