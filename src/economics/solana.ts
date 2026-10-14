import {
  address, appendTransactionMessageInstructions, blockhash, createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage, getBase64EncodedWireTransaction, getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction, getTransactionDecoder, pipe, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, verifySignature, type ReadonlyUint8Array,
} from '@solana/kit';
import { getTransferSolInstruction, SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { getAddMemoInstruction, MEMO_PROGRAM_ADDRESS } from '@solana-program/memo';
import type { ChainGateway, PaymentIntent, PaymentVerification } from './chain.js';

export const SOLANA_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const PRICE = 1_000_000n;
const MAX_FEE = 100_000n;
type Transport = (url: string, init: RequestInit) => Promise<Response>;
const integer = (value: unknown): bigint => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid RPC number.');
  return BigInt(value);
};
const sol = (value: bigint) => `${value / 1_000_000_000n}.${(value % 1_000_000_000n).toString().padStart(9, '0')}`.replace(/\.?0+$/, '');

export async function createSolanaGateway(rpcUrl: string, buyerSecret: Uint8Array, sellerAddress: string, transport: Transport = fetch): Promise<ChainGateway> {
  let url: URL;
  try { url = new URL(rpcUrl); } catch { throw new Error('Invalid Solana RPC URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Solana devnet RPC must use HTTPS without credentials.');
  const signer = await createKeyPairSignerFromPrivateKeyBytes(buyerSecret);
  const seller = address(sellerAddress);
  if (seller === signer.address) throw new Error('Buyer and seller must differ.');
  let closed = false;
  async function rpc(method: string, params: unknown[] = []): Promise<any> {
    if (closed) throw new Error('Gateway closed.');
    const response = await transport(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('RPC unavailable.');
    const body = await response.json() as { result?: unknown; error?: unknown };
    if (body.error || !Object.hasOwn(body, 'result')) throw new Error('RPC failed.');
    return body.result;
  }
  async function safe<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch { throw new Error('Solana payment operation failed. Check devnet funds and this order before retrying.'); }
  }
  async function assertDevnet() {
    if (await rpc('getGenesisHash') !== SOLANA_DEVNET_GENESIS) throw new Error('Unexpected Solana cluster.');
  }
  function memoFor(intent: PaymentIntent) {
    if (intent.buyer !== signer.address || intent.seller !== seller || intent.amountAtomic !== PRICE.toString()
      || !/^0x(?:[a-fA-F0-9]{2})+$/.test(intent.data)) throw new Error('Invalid fixed-price Solana intent.');
    const memo = Buffer.from(intent.data.slice(2), 'hex').toString('utf8');
    if (!/^experiencebridge:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{64}$/.test(memo)) throw new Error('Invalid order memo.');
    return memo;
  }
  async function decodeAndValidate(raw: string, intent?: PaymentIntent) {
    if (raw.length > 1800 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('Invalid signed transaction.');
    const transaction = getTransactionDecoder().decode(Buffer.from(raw, 'base64'));
    if (getBase64EncodedWireTransaction(transaction) !== raw) throw new Error('Noncanonical signed transaction.');
    const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
    if (message.version !== 'legacy' || message.header.numSignerAccounts !== 1
      || message.header.numReadonlySignerAccounts !== 0 || message.header.numReadonlyNonSignerAccounts !== 2
      || message.staticAccounts.length !== 4 || message.staticAccounts[0] !== signer.address
      || message.staticAccounts[1] !== seller || message.instructions.length !== 2) throw new Error('Unexpected payment message.');
    const [transfer, memo] = message.instructions;
    const transferData = Buffer.from(transfer.data ?? []);
    if (message.staticAccounts[transfer.programAddressIndex] !== SYSTEM_PROGRAM_ADDRESS
      || transfer.accountIndices?.length !== 2 || transfer.accountIndices[0] !== 0 || transfer.accountIndices[1] !== 1
      || transferData.length !== 12 || transferData.readUInt32LE(0) !== 2 || transferData.readBigUInt64LE(4) !== PRICE
      || message.staticAccounts[memo.programAddressIndex] !== MEMO_PROGRAM_ADDRESS || (memo.accountIndices?.length ?? 0) !== 0) throw new Error('Unexpected payment instructions.');
    const memoText = Buffer.from(memo.data ?? []).toString('utf8');
    const expectedMemo = memoFor(intent ?? { buyer: signer.address, seller, amountAtomic: PRICE.toString(), data: '0x' + Buffer.from(memoText).toString('hex') });
    if (memoText !== expectedMemo || !Buffer.from(memo.data ?? []).equals(Buffer.from(expectedMemo))) throw new Error('Order memo mismatch.');
    const signature = transaction.signatures[signer.address];
    if (!signature || !(await verifySignature(signer.keyPair.publicKey, signature, transaction.messageBytes))) throw new Error('Payment signature invalid.');
    return { transaction, message, hash: getSignatureFromTransaction(transaction) };
  }
  async function feeFor(messageBytes: ReadonlyUint8Array) {
    const result = await rpc('getFeeForMessage', [Buffer.from(messageBytes).toString('base64'), { commitment: 'confirmed' }]);
    const fee = integer(result?.value);
    if (fee === 0n || fee > MAX_FEE) throw new Error('Fee limit exceeded or blockhash expired.');
    return fee;
  }
  return {
    buyerAddress: signer.address, sellerAddress: seller, mode: 'solana-devnet', chainId: SOLANA_DEVNET_GENESIS,
    rpcUrl, explorerUrl: 'https://explorer.solana.com', currency: 'SOL', amountAtomic: PRICE.toString(), price: '0.001', maxFee: '0.0001',
    transactionUrl: hash => `https://explorer.solana.com/tx/${encodeURIComponent(hash)}?cluster=devnet`,
    balances: () => safe(async () => {
      await assertDevnet();
      const [buyer, recipient] = await Promise.all([rpc('getBalance', [signer.address, { commitment: 'finalized' }]), rpc('getBalance', [seller, { commitment: 'finalized' }])]);
      return { buyer: sol(integer(buyer?.value)), seller: sol(integer(recipient?.value)) };
    }),
    prepare: intent => safe(async () => {
      const memo = memoFor(intent);
      await assertDevnet();
      const latest = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
      const lifetime = { blockhash: blockhash(latest?.value?.blockhash), lastValidBlockHeight: integer(latest?.value?.lastValidBlockHeight) };
      const message = pipe(createTransactionMessage({ version: 'legacy' }),
        tx => setTransactionMessageFeePayerSigner(signer, tx),
        tx => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
        tx => appendTransactionMessageInstructions([getTransferSolInstruction({ source: signer, destination: seller, amount: PRICE }), getAddMemoInstruction({ memo })], tx));
      const transaction = await signTransactionMessageWithSigners(message);
      const fee = await feeFor(transaction.messageBytes);
      const balance = await rpc('getBalance', [signer.address, { commitment: 'confirmed' }]);
      if (integer(balance?.value) < PRICE + fee) throw new Error('Insufficient devnet SOL.');
      const rawTransaction = getBase64EncodedWireTransaction(transaction);
      await decodeAndValidate(rawTransaction, intent);
      const simulation = await rpc('simulateTransaction', [rawTransaction, { encoding: 'base64', commitment: 'confirmed', sigVerify: true, replaceRecentBlockhash: false }]);
      if (!simulation?.value || simulation.value.err !== null) throw new Error('Payment simulation failed.');
      await assertDevnet();
      return { rawTransaction, transactionHash: getSignatureFromTransaction(transaction) };
    }),
    broadcast: raw => safe(async () => {
      await assertDevnet();
      const decoded = await decodeAndValidate(raw);
      await feeFor(decoded.transaction.messageBytes);
      await assertDevnet();
      const sent = await rpc('sendTransaction', [raw, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 }]);
      if (sent !== decoded.hash) throw new Error('Broadcast signature mismatch.');
    }),
    verify: (intent, hash) => safe(async (): Promise<PaymentVerification> => {
      memoFor(intent);
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(hash)) throw new Error('Invalid Solana signature.');
      await assertDevnet();
      const result = await rpc('getTransaction', [hash, { commitment: 'finalized', encoding: 'base64', maxSupportedTransactionVersion: 0 }]);
      if (result === null) return { state: 'pending', reason: 'Waiting for finalized Solana transaction evidence. Expired or missing transactions require review; retries never re-sign.' };
      await assertDevnet();
      if (!result?.meta || result.meta.err !== null) return { state: 'rejected', reason: 'Solana transaction failed or metadata is unavailable.' };
      try {
        if (!Array.isArray(result.transaction) || result.transaction[1] !== 'base64') throw new Error();
        const decoded = await decodeAndValidate(result.transaction[0], intent);
        if (decoded.hash !== hash) throw new Error();
        const fee = integer(result.meta.fee);
        if (fee > MAX_FEE || integer(result.meta.postBalances?.[1]) - integer(result.meta.preBalances?.[1]) !== PRICE
          || integer(result.meta.preBalances?.[0]) - integer(result.meta.postBalances?.[0]) !== PRICE + fee) throw new Error();
        const slot = integer(result.slot);
        return { state: 'confirmed', reason: 'Exact Solana payment verified at finalized commitment.', blockNumber: Number(slot) };
      } catch { return { state: 'rejected', reason: 'Finalized Solana payment does not match this order.' }; }
    }),
    close: () => { closed = true; },
  };
}
