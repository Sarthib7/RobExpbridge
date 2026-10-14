import { FetchRequest, JsonRpcProvider, Wallet, Transaction, formatEther, getAddress, keccak256 } from 'ethers';

export type NetworkMode = 'agung' | 'local' | 'solana-devnet';
export type PaymentIntent = { buyer: string; seller: string; amountAtomic: string; data: string };
export type PreparedPayment = { rawTransaction: string; transactionHash: string };
export type PaymentVerification = { state: 'pending' | 'confirmed' | 'rejected'; reason: string; blockNumber?: number };
export interface ChainGateway {
  buyerAddress: string; sellerAddress: string; mode: NetworkMode; chainId: number | string;
  rpcUrl: string; explorerUrl: string; currency: string;
  amountAtomic: string; price: string; maxFee: string; transactionUrl(hash: string): string;
  balances(): Promise<{ buyer: string; seller: string }>;
  prepare(intent: PaymentIntent): Promise<PreparedPayment>;
  broadcast(raw: string): Promise<void>;
  verify(intent: PaymentIntent, hash: string): Promise<PaymentVerification>;
  close(): void;
}
const PRICE = 1000000000000000n;
const MAX_FEE = 10000000000000000n;
const equal = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
type RpcTransaction = { hash: string; from: string; to: string | null; value: string; input: string; chainId: string; blockHash: string | null; blockNumber: string | null };
type RpcReceipt = { transactionHash: string; from: string; to: string | null; status: string; blockHash: string; blockNumber: string };
type RpcBlock = { hash: string; number: string };

// RPC inclusion is trusted evidence from the configured node, not an independent consensus proof.
export function checkPaymentEvidence(intent: PaymentIntent, hash: string, chainId: number,
  tx: RpcTransaction | null, receipt: RpcReceipt | null, canonical: RpcBlock | null,
  finalized: RpcBlock | null): PaymentVerification {
  const reject = (reason: string): PaymentVerification => ({ state: 'rejected', reason });
  const pending = (reason: string): PaymentVerification => ({ state: 'pending', reason });
  if (!tx) return pending('Transaction not found.');
  try {
    if (!equal(tx.hash, hash) || !equal(tx.from, intent.buyer) || !equal(tx.to, intent.seller)
      || BigInt(tx.value) !== BigInt(intent.amountAtomic) || !equal(tx.input, intent.data)
      || BigInt(tx.chainId) !== BigInt(chainId)) return reject('Transaction does not match this order.');
    if (!receipt) return pending('Waiting for transaction inclusion.');
    if (!equal(receipt.transactionHash, hash) || !equal(receipt.from, intent.buyer)
      || !equal(receipt.to, intent.seller)) return reject('Receipt does not match this order.');
    if (BigInt(receipt.status) !== 1n) return reject('Transaction reverted or receipt status is invalid.');
    if (!canonical || !finalized) return pending('Finalized chain evidence unavailable.');
    if (!equal(canonical.hash, receipt.blockHash) || !equal(tx.blockHash, receipt.blockHash)
      || BigInt(canonical.number) !== BigInt(receipt.blockNumber)
      || tx.blockNumber === null || BigInt(tx.blockNumber) !== BigInt(receipt.blockNumber)) {
      return pending('Transaction inclusion is not canonical.');
    }
    if (BigInt(finalized.number) < BigInt(receipt.blockNumber)) return pending('Waiting for finalized inclusion.');
    const blockNumber = Number(BigInt(receipt.blockNumber));
    if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) return reject('Invalid block number.');
    return { state: 'confirmed', reason: 'Exact payment verified in a canonical finalized block.', blockNumber };
  } catch { return reject('Invalid payment evidence.'); }
}

export function createGateway(mode: NetworkMode, rpcUrl: string, buyerPrivateKey: string, sellerAddress: string): ChainGateway {
  if (mode !== 'local' && mode !== 'agung') throw new Error('Unsupported payment network.');
  let url: URL;
  try { url = new URL(rpcUrl); } catch { throw new Error('Invalid RPC URL.'); }
  if (url.username || url.password || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid RPC URL.');
  if (mode === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local RPC must use loopback.');
  if (mode === 'agung' && url.protocol !== 'https:') throw new Error('Agung RPC must use HTTPS.');
  const chainId = mode === 'agung' ? 9990 : 31337;
  const request = new FetchRequest(rpcUrl);
  request.timeout = 10_000;
  const provider = new JsonRpcProvider(request, chainId, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
  let wallet: Wallet;
  let seller: string;
  try { wallet = new Wallet(buyerPrivateKey, provider); seller = getAddress(sellerAddress); }
  catch { provider.destroy(); throw new Error('Invalid payment wallet configuration.'); }
  if (wallet.address === seller) { provider.destroy(); throw new Error('Buyer and seller must differ.'); }
  async function safe<T>(operation: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error()), 10_000);
      })]);
    } catch { throw new Error('Payment RPC operation failed. Check network, funds, and transaction status before retrying.'); }
    finally { if (timer) clearTimeout(timer); }
  }
  async function assertChain() {
    const live = await provider.send('eth_chainId', []);
    if (BigInt(live) !== BigInt(chainId)) throw new Error('Unexpected chain.');
  }
  function validate(intent: PaymentIntent) {
    if (!equal(intent.buyer, wallet.address) || !equal(intent.seller, seller)
      || intent.amountAtomic !== PRICE.toString() || !/^0x(?:[0-9a-fA-F]{2}){1,128}$/.test(intent.data)) {
      throw new Error('Invalid fixed-price payment intent.');
    }
  }
  function validateSigned(raw: string) {
    const tx = Transaction.from(raw);
    validate({ buyer: tx.from ?? '', seller: tx.to ?? '', amountAtomic: tx.value.toString(), data: tx.data });
    if (tx.chainId !== BigInt(chainId) || !tx.isSigned() || (tx.type !== 0 && tx.type !== 2)
      || tx.gasLimit <= 0n || tx.gasLimit * (tx.maxFeePerGas ?? tx.gasPrice ?? MAX_FEE + 1n) > MAX_FEE) {
      throw new Error('Signed transaction violates payment limits.');
    }
  }
  return {
    buyerAddress: wallet.address, sellerAddress: seller, mode, chainId, rpcUrl,
    explorerUrl: mode === 'agung' ? 'https://agung-testnet.subscan.io' : '',
    currency: mode === 'agung' ? 'AGUNG' : 'ETH',
    amountAtomic: PRICE.toString(), price: '0.001', maxFee: '0.01',
    transactionUrl: hash => mode === 'agung' ? `https://agung-testnet.subscan.io/tx/${hash}` : '',
    balances: () => safe(async () => {
      await assertChain();
      const [buyer, sellerBalance] = await Promise.all([provider.getBalance(wallet.address), provider.getBalance(seller)]);
      return { buyer: formatEther(buyer), seller: formatEther(sellerBalance) };
    }),
    prepare: (intent) => safe(async () => {
      validate(intent);
      await assertChain();
      const transaction = await wallet.populateTransaction({ to: seller, value: PRICE, data: intent.data, chainId });
      const maximumFee = BigInt(transaction.gasLimit ?? 0) * BigInt(transaction.maxFeePerGas ?? transaction.gasPrice ?? 0);
      if (maximumFee > MAX_FEE || await provider.getBalance(wallet.address) < PRICE + maximumFee) {
        throw new Error('Insufficient test funds or fee limit exceeded.');
      }
      await assertChain();
      const rawTransaction = await wallet.signTransaction(transaction);
      validateSigned(rawTransaction);
      return { rawTransaction, transactionHash: keccak256(rawTransaction) };
    }),
    broadcast: (raw) => safe(async () => {
      validateSigned(raw);
      await assertChain();
      const result = await provider.send('eth_sendRawTransaction', [raw]);
      if (!equal(result, keccak256(raw))) throw new Error('Unexpected broadcast hash.');
    }),
    verify: (intent, hash) => safe(async () => {
      validate(intent);
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Invalid transaction hash.');
      await assertChain();
      const [tx, receipt] = await Promise.all([
        provider.send('eth_getTransactionByHash', [hash]) as Promise<RpcTransaction | null>,
        provider.send('eth_getTransactionReceipt', [hash]) as Promise<RpcReceipt | null>,
      ]);
      let canonical: RpcBlock | null = null;
      let finalized: RpcBlock | null = null;
      if (receipt) {
        [canonical, finalized] = await Promise.all([
          provider.send('eth_getBlockByNumber', [receipt.blockNumber, false]),
          provider.send('eth_getBlockByNumber', ['finalized', false]),
        ]);
      }
      await assertChain();
      return checkPaymentEvidence(intent, hash, chainId, tx, receipt, canonical, finalized);
    }),
    close: () => provider.destroy(),
  };
}
