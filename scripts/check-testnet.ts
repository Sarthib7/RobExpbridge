import { loadTestWallets } from '../src/economics/wallets.js';
import { createGateway } from '../src/economics/chain.js';
import { join } from 'node:path';
const wallets = await loadTestWallets(join(process.env.EB_DATA_DIR ?? 'data/local', 'test-wallets.json'));
const gateway = createGateway('agung', process.env.PEAQ_RPC_URL ?? 'https://peaq-agung.api.onfinality.io/public', wallets.buyerPrivateKey, wallets.sellerAddress);
try {
 const balances = await gateway.balances();
 console.log(JSON.stringify({ network:'Agung testnet',chainId:9990,currency:gateway.currency,buyerAddress:gateway.buyerAddress,sellerAddress:gateway.sellerAddress,balances,faucet:'https://docs.peaq.xyz/peaqchain/build/getting-started/get-test-tokens',note:'Read-only readiness check. No payment sent.' },null,2));
} finally { gateway.close(); }
