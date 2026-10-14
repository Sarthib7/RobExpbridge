# Payment slice contract

2026-10-13. Owner: coordinator. Status: Implemented locally. Agung settlement awaits faucet funding.

INFERRED implementation decisions for the requested payment MVP:

- Local EVM mode: chain 31337, loopback RPC, test wallets funded by Anvil. Agung mode: chain 9990, official RPC, user obtains faucet tokens.
- Two random local EVM wallets represent the synthetic contributor and buyer. Keys stay in ignored files, mode 0600. These are not registered peaq machine IDs.
- One fixed license costs 0.001 native test tokens. This is a chosen demo price, not a market price.
- Orders bind buyer, seller, value, record digest and context. A random order ID is encoded in transaction data.
- Persist the signed transaction before broadcast. Retrying an order broadcasts the same bytes, never a new payment.
- Unlock only after success, exact transfer matching, canonical inclusion and finalized block verification.
- Public APIs return metadata only when commerce is enabled. Order bearer tokens protect access; simulation rechecks compatibility.
- Local service binds loopback. Reject foreign Host/Origin values and require a custom header on mutating commerce requests.

## Agent ownership

Coordinator: orders, persistence, server, startup, scripts and integration tests.
Payments agent: src/economics/chain.ts and tests/chain.test.ts only.
Frontend agent: public/index.html, public/app.js and public/styles.css only.
Research agent: official testnet source lookup, read-only.

## Gateway

`NetworkMode = 'agung' | 'local'`.
`PaymentIntent = { buyer: string; seller: string; amountWei: string; data: string }`.
`PreparedPayment = { rawTransaction: string; transactionHash: string }`.
`PaymentVerification = { state: 'pending' | 'confirmed' | 'rejected'; reason: string; blockNumber?: number }`.
`ChainGateway` exposes buyerAddress, sellerAddress, mode, chainId, rpcUrl, explorerUrl, currency.
Methods: balances(): Promise<{buyer: string; seller: string}> (formatted native units); prepare(intent): Promise<PreparedPayment>; broadcast(raw): Promise<void>; verify(intent,hash): Promise<PaymentVerification>; close(): void.
Export `createGateway(mode, rpcUrl, buyerPrivateKey, sellerAddress): ChainGateway` from chain.ts.

## Browser API

JSON requests send `x-experiencebridge-client: local-ui`. Mutating requests use POST with application/json.
Errors return `{ error: string, code?: string }` and non-2xx status.
GET /api/config: `{ mode, chainId, networkName, currency, price: '0.001', buyerAddress, sellerAddress, faucetUrl, explorerUrl }`.
GET /api/network: `{ connected: true, buyerBalance, sellerBalance, currency }` or error.
POST /api/demo/publish `{}`: `{ id, contributor, evidence, context }`. Idempotently seeds exp-001.
POST /experiences/query `{task:'connector_insertion',context,use:'synthetic-demo'}`: `{results:[{id,status,reasons,advisory:null,evidence?,contributor?}]}`. Compatible match still hides advisory until paid.
POST /simulation/run `{context}`: baseline result.
POST /api/orders `{experienceId:'exp-001',context,idempotencyKey:<uuid>}`: `{ order, token }`.
Order: `{id,experienceId,state:'quoted'|'pending'|'confirmed'|'rejected',price,currency,buyerAddress,sellerAddress,expiresAt,transactionHash:null|string,explorerUrl:null|string,reason:string}`.
GET /api/orders/:id: same `{order}`. Needs `Authorization: Bearer <token>`.
POST /api/orders/:id/pay `{}`: same `{order}`. Needs token. Signs/broadcasts exactly once. Does not poll finality.
POST /api/orders/:id/verify `{}`: same `{order}`. Needs token. Rechecks receipt/finality.
GET /api/orders/:id/advisory: `{advisory,evidence,contributor,advisoryOnly:true}`. Needs token and confirmed order.
POST /api/orders/:id/run `{}`: recovery result. Needs token and confirmed order.
Context defaults: `{robotModel:'arm-x',gripper:'parallel-v1',connector:'connector-demo',material:'polymer-demo',fixture:'fixture-7',forceLimitN:12}`. Arm C uses gripper vacuum-v2.
Persist order ID + token in sessionStorage for reload recovery. Never store wallet keys in browser.

## Least confident decisions

1. VERIFIED: public RPC finality queries work. Faucet-reported funding did not appear in RPC balances or receipts; its cause remains unknown.
2. Custodial test wallets simplify setup but restrict this app to trusted local use.
3. Source-visible synthetic recovery demonstrates payment enforcement, not secret commercial knowledge.
