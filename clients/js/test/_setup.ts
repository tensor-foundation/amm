// /* eslint-disable import/no-extraneous-dependencies */
// import '@solana/webcrypto-ed25519-polyfill';

// import {
//   generateKeyPairSigner,
//   signTransactionWithSigners,
//   KeyPairSigner,
//   createSignerFromKeyPair,
// } from '@solana/signers';
// import {
//   Address,
//   Commitment,
//   CompilableTransaction,
//   createDefaultAirdropRequester,
//   createDefaultRpcSubscriptionsTransport,
//   createDefaultRpcTransport,
//   createDefaultTransactionSender,
//   createPrivateKeyFromBytes,
//   createSolanaRpc,
//   createSolanaRpcSubscriptions,
//   createTransaction,
//   getSignatureFromTransaction,
//   ITransactionWithBlockhashLifetime,
//   lamports,
//   pipe,
//   setTransactionFeePayer,
//   setTransactionLifetimeUsingBlockhash,
// } from '@solana/web3.js';

// const OWNER = [
//   2, 137, 224, 78, 3, 88, 80, 1, 90, 104, 69, 173, 41, 72, 156, 101, 61, 28,
//   161, 206, 55, 239, 245, 124, 205, 126, 177, 10, 77, 15, 2, 196, 28, 187, 45,
//   102, 121, 86, 21, 222, 190, 244, 255, 22, 1, 5, 21, 171, 100, 22, 199, 167,
//   131, 109, 27, 207, 206, 139, 62, 136, 6, 69, 15, 209,
// ];

// const COSIGNER = [
//   63, 201, 215, 122, 70, 129, 164, 234, 138, 215, 154, 200, 69, 41, 220, 47, 84,
//   238, 101, 234, 165, 187, 198, 195, 211, 71, 210, 107, 95, 83, 26, 152, 211,
//   35, 143, 215, 197, 161, 88, 73, 106, 218, 0, 209, 140, 249, 174, 18, 232, 128,
//   243, 136, 151, 255, 53, 244, 12, 20, 94, 128, 72, 199, 46, 187,
// ];

// export type Client = {
//   rpc: ReturnType<typeof createSolanaRpc>;
//   rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
// };

// export const setupSigners = async (client: Client) => {
//   const owner = await generateKeyPairSignerWithSol(client);
//   const cosigner = await createKeyPairSigner(client, Uint8Array.from(COSIGNER));

//   await fundWalletWithSol(client, owner.address);
//   await fundWalletWithSol(client, cosigner.address);

//   return { owner, cosigner };
// };

// export const createDefaultSolanaClient = (): Client => {
//   const rpc = createSolanaRpc({
//     transport: createDefaultRpcTransport({ url: 'http://127.0.0.1:8899' }),
//   });
//   const rpcSubscriptions = createSolanaRpcSubscriptions({
//     transport: createDefaultRpcSubscriptionsTransport({
//       url: 'ws://127.0.0.1:8900',
//     }),
//   });

//   return { rpc, rpcSubscriptions };
// };

// export const createKeyPairSigner = async (
//   client: Client,
//   bytes: Uint8Array
// ): Promise<KeyPairSigner<string>> => {
//   const publicKeyBytes = bytes.slice(32);
//   const privateKeyBytes = bytes.slice(0, 32);

//   const [publicKey, privateKey] = await Promise.all([
//     crypto.subtle.importKey('raw', publicKeyBytes, 'Ed25519', true, ['verify']),
//     createPrivateKeyFromBytes(privateKeyBytes),
//   ]);
//   return createSignerFromKeyPair({ privateKey, publicKey });
// };

// export const generateKeyPairSignerWithSol = async (
//   client: Client,
//   putativeLamports: bigint = 1_000_000_000n
// ) => {
//   const airdropRequester = createDefaultAirdropRequester(client);
//   const signer = await generateKeyPairSigner();
//   await airdropRequester({
//     recipientAddress: signer.address,
//     lamports: lamports(putativeLamports),
//     commitment: 'confirmed',
//   });
//   return signer;
// };

// export const fundWalletWithSol = async (
//   client: Client,
//   address: Address,
//   putativeLamports: bigint = 1_000_000_000n
// ) => {
//   const airdropRequester = createDefaultAirdropRequester(client);
//   await airdropRequester({
//     recipientAddress: address,
//     lamports: lamports(putativeLamports),
//     commitment: 'confirmed',
//   });
// };

// export const createDefaultTransaction = async (
//   client: Client,
//   feePayer: Address
// ) => {
//   const { value: latestBlockhash } = await client.rpc
//     .getLatestBlockhash()
//     .send();
//   return pipe(
//     createTransaction({ version: 0 }),
//     (tx) => setTransactionFeePayer(feePayer, tx),
//     (tx) => setTransactionLifetimeUsingBlockhash(latestBlockhash, tx)
//   );
// };

// export const signAndSendTransaction = async (
//   client: Client,
//   transaction: CompilableTransaction & ITransactionWithBlockhashLifetime,
//   commitment: Commitment = 'confirmed'
// ) => {
//   const signedTransaction = await signTransactionWithSigners(transaction);
//   const signature = getSignatureFromTransaction(signedTransaction);
//   await createDefaultTransactionSender(client)(signedTransaction, {
//     commitment,
//   });
//   return signature;
// };

// export const getBalance = async (client: Client, address: Address) =>
//   (await client.rpc.getBalance(address, { commitment: 'confirmed' }).send())
//     .value;
