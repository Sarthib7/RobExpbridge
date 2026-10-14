# ExperienceBridge v0.1

Try the payment flow locally:

```sh
npm install
npm run dev:local
# Open http://127.0.0.1:3333
```

VERIFIED prerequisites: Node.js 22+ (`package.json`) and Anvil (`scripts/local-node.ts`).
Install Anvil through [Foundry's official instructions](https://getfoundry.sh/introduction/installation) if needed.
The local runner starts chain 31337 and funds the buyer with local test ETH.
It preserves chain state on graceful shutdown. Stop it with Ctrl+C.

1. Click Publish sample, then Run baseline. Arm B slips at 12 N.
2. Click Check compatibility with Arm B selected, then create a quote.
3. Pay 0.001 local ETH. Wait for confirmation, then run the purchased recovery at 8 N.
4. Select Arm C and check compatibility. Its gripper mismatch blocks a quote.

VERIFIED browser observation: this path reached `confirmed` and `success`.
Reloading restored the paid order without sending another payment.
This mode uses a real local EVM transaction. It is not a peaq transaction.

## peaq Agung testnet

```sh
npm run start:agung
# Open http://127.0.0.1:3334
```

VERIFIED source: `src/economics/runtime.ts` creates buyer and contributor test wallets automatically.
No browser wallet extension or private key input is needed.
Keys stay in ignored `data/local/test-wallets.json`, with file mode 0600.
Never use these wallets for real funds or publish the data directory.

1. Copy the buyer address from the page.
2. Request tokens through the page's Get test tokens link.
3. Refresh balances. Once funded, use the same publish, quote and payment steps above.

Read balances without signing a transaction:

```sh
npm run testnet:check
```

VERIFIED network configuration: Agung chain ID 9990, token AGUNG, 18 decimals.
The official RPC is `https://peaq-agung.api.onfinality.io/public`.
Sources: [peaq connection guide](https://docs.peaq.xyz/peaqchain/build/getting-started/connecting-to-peaq) and [test tokens](https://docs.peaq.xyz/peaqchain/build/getting-started/get-test-tokens).
Session RPC responses were `eth_chainId: 0x2706` and `system_properties: {tokenDecimals:18,tokenSymbol:'AGUNG'}`.

VERIFIED funding blocker, 2026-10-13: the official faucet reported funding, but both official RPC endpoints returned buyer balance `0x0`.
The reported faucet hash returned `null` for its receipt and transaction. The explorer said the transaction was not found.
No Agung payment has been confirmed. The cause of the faucet discrepancy is not determined.
See [status.md](status.md) for the exact hash and evidence.

## Checks and working examples

```sh
npm test
npm run check
npm run build
npm run demo:payments
npm run demo
```

VERIFIED session output: `tests 63`, `pass 63`, `fail 0`.
`npm run check`, `npm run build` and `node --check public/app.js` exited 0.
`demo:payments` starts a disposable Anvil chain and verifies the complete HTTP payment path.
Its output included `payment: confirmed`, `sellerReceived: 0.001 local ETH`, `baseline: slip`, and `recovery: success`.
It also checks unpaid access, incompatible quotes, request-origin guards and retries without a second transfer.
These checks prove only the exercised local paths. Public testnet settlement remains unverified.

VERIFIED source: `scripts/demo.ts` retains the original simulator-only example with an explicitly simulated payment receipt and null hash.
Correction to the earlier README: the old statement that this project has no wallet or payment integration is now obsolete.
The payment gateway uses ethers for native EVM transfers. The legacy `src/economics/peaq.ts` stub remains explicitly simulated.

VERIFIED configuration: `.github/workflows/test.yml` runs checks on Node 22 and 24, including the local payment example.
Correction: this folder now tracks `Sarthib7/RobExpbridge` on `checkpoint/devnet-batches`. Remote CI for these changes has not run.

## Payment boundary

VERIFIED source: `src/economics/orders.ts` binds each order to a record digest, context, recipient and amount.
The chosen demo price is 0.001 native test tokens, plus gas capped at 0.01 native test tokens.
The quote expires after ten minutes. Expiry prevents new signing; saved transactions can still be retried and verified.
Signed bytes are saved before broadcast. Retries use those same bytes.
A pending order blocks another payment from the shared buyer wallet.

VERIFIED source: `src/economics/chain.ts` accepts only the configured test chain.
Unlock requires an exact successful transfer in a canonical finalized block. Access checks the chain again.
Failed or unavailable verification does not unlock the advisory.
This is a direct transfer, without escrow or automatic refunds. A record revoked after payment can block access.

VERIFIED source: `src/server.ts` binds loopback, rejects foreign Host/Origin values and requires a custom header on mutations.
Commerce endpoints hide the advisory until a valid order token and confirmed payment permit access.
This local demo is custodial. Any trusted local user who controls its files can control its wallets.
Do not expose the server publicly. There is no production identity or access-control system.
The recovery is visible in source code; this demo does not protect commercial secrets.

VERIFIED source: `src/economics/runtime.ts` keeps orders and experiences separate for each network.
One runtime lock permits one server per network and data directory. Graceful shutdown releases the lock.
After a crash, inspect the PID in `data/local/runtime-<mode>.lock` and confirm the process has stopped before removing a stale lock.
Power-loss durability is untested.
Optional exported settings are documented in `.env.example`. The scripts do not load `.env` automatically.

## Simulation boundary

VERIFIED source: `src/memory/match.ts` requires matching hardware, context, current records and reproducible simulation evidence.
Arm B slips at 12 N and succeeds at 8 N under one constructed fixture with seed 7.
Each outcome has denominator 1. These results do not establish physical robot performance or safety.
The service returns typed advisories and never issues physical robot commands.

VERIFIED source: `src/memory/integrity.ts` hashes canonical content without its digest field.
This detects changes relative to a saved digest, but does not authenticate the contributor.
Replacing both the record and its digest can evade that check.
Machine identities are synthetic, not registered peaqOS identities. dstack and hardware attestation are not implemented.
No TEE confidentiality is claimed. Only synthetic data belongs in this demo.

API shapes and implementation decisions: [payment contract](docs/payments-contract.md).

## Solana devnet and peaqOS setup

VERIFIED source: `src/economics/solana.ts` uses Solana Kit for native devnet transfers with an order and digest memo.
Run `npm run start:solana`, then open `http://127.0.0.1:3335`.
The dedicated test keys stay under ignored `data/local/solana-test-wallets.json`.
The price is 0.001 SOL and the fee cap is 0.0001 SOL per transfer.

VERIFIED [readiness report](data/evidence/peaqos-readiness.json): the peaqOS SDK returned an Entry bond of 0.4 AGUNG.
Activation is blocked by zero balance. The computed Arm B machine ID is not registered or bound to orders.
`npm run peaqos:check` refreshes the recorded preview. `npm run peaqos:activate` requests activation after funding and explicit operator intent.
Solana devnet settlement is separate from mainnet-only peaqOS Solana onboarding.

```sh
npm run demo:batches
npm run build:public
# After test funding, choose a new unique run ID for each network:
npm run batch:devnet -- --network=agung --count=12 --run-id=your-unique-id
npm run batch:devnet -- --network=solana-devnet --count=12 --run-id=your-unique-id
```

VERIFIED [evidence index](evidence.md): 12 constructed checks passed; both requested public batches remain blocked.
Each public batch checks funds before signing and stops on the first unresolved payment.
A retry must use the recorded order, not create another payment.

## Public preview

VERIFIED source: `src/public-worker.ts` exposes the synthetic simulator and recorded evidence without importing a signer.
`npm run build:public` embeds the pitch-branded interface and public reports in `dist/public/worker.js`.
The public preview cannot submit payments. Local test workspaces retain the payment flow.
Cloudflare hosting status is recorded in `status.md` after deployment verification.
