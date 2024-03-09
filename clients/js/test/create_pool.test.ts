import test from 'ava';
import { none, some } from '@solana/options';
import {
  addSignersToTransaction,
  generateKeyPairSigner,
  getSignersFromTransaction,
} from '@solana/signers';
import { appendTransactionInstruction, pipe } from '@solana/web3.js';
import {
  Authority,
  Whitelist,
  fetchAuthority,
  fetchWhitelist,
  findAuthorityPda,
  findWhitelistPda,
  getInitUpdateAuthorityInstructionAsync,
  getInitUpdateWhitelistInstructionAsync,
} from '@tensor-foundation/whitelist';
import {
  Pool,
  fetchPool,
  findPoolPda,
  findSolEscrowPda,
  getCreatePoolInstruction,
} from '../src';
import {
  createDefaultSolanaClient,
  createDefaultTransaction,
  generateKeyPairSignerWithSol,
  setupSigners,
  signAndSendTransaction,
} from './_setup';

test('it can create new accounts', async (t) => {
  // Given a client and a new signer.
  const client = createDefaultSolanaClient();
  const { cosigner, owner } = await setupSigners(client);
  const identifier = Uint8Array.from({ length: 32 }, () => 1);
  const rootHash = Uint8Array.from({ length: 32 }, () => 0);

  const createWhiteListAuthorityIx =
    await getInitUpdateAuthorityInstructionAsync({
      owner,
      cosigner,
      newOwner: owner.address,
      newCosigner: cosigner.address,
    });

  const [whitelist] = await findWhitelistPda({ uuid: identifier });

  const createWhitelistIx = await getInitUpdateWhitelistInstructionAsync({
    whitelist,
    cosigner,
    uuid: identifier,
    name: identifier,
    fvc: owner.address,
    rootHash: none(),
    voc: none(),
  });

  const [pool, poolBump] = await findPoolPda({
    owner: owner.address,
    identifier,
  });
  const [solEscrow, solEscrowBump] = await findSolEscrowPda({ pool });

  // When we create a new account.
  const createPoolIx = getCreatePoolInstruction({
    owner: owner.address,
    pool,
    solEscrow,
    whitelist,
    identifier,
    config: {
      poolType: 0,
      curveType: 0,
      startingPrice: 1,
      delta: 1,
      mmCompoundFees: false,
      mmFeeBps: none(),
    },
    maxTakerSellCount: 0,
    cosigner: some(cosigner.address),
    orderType: 0,
  });

  await pipe(
    await createDefaultTransaction(client, owner.address),
    (tx) => appendTransactionInstruction(createWhiteListAuthorityIx, tx),
    (tx) => appendTransactionInstruction(createWhitelistIx, tx),
    (tx) => appendTransactionInstruction(createPoolIx, tx),
    (tx) => signAndSendTransaction(client, tx)
  );

  // Then a whitelist authority was created with the correct data.
  const [authority] = await findAuthorityPda();
  t.like(await fetchAuthority(client.rpc, authority), <Authority>{
    address: authority,
    data: {
      owner: owner.address,
      cosigner: cosigner.address,
    },
  });

  //   And the whitelist was created with the correct data.
  t.like(await fetchWhitelist(client.rpc, whitelist), <Whitelist>(<unknown>{
    address: whitelist,
    data: {
      uuid: identifier,
      name: identifier,
      fvc: some(owner.address),
      rootHash,
      voc: none(),
    },
  }));

  // Then an account was created with the correct data.
  t.like(await fetchPool(client.rpc, pool), <Pool>(<unknown>{
    address: pool,
    data: {
      config: {
        poolType: 0,
        curveType: 0,
        startingPrice: 1n,
        delta: 1n,
        mmCompoundFees: false,
        mmFeeBps: none(),
      },
    },
  }));
});
