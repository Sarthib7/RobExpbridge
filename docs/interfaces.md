# MVP contracts

INFERRED implementation choices, owner: coordinator, 2026-10-13.

Records use the fields in mvp.md plus connector, expiry, revocation and permitted demo use.
Matching returns compatible, incompatible, requires_review or rejected, with reasons.
Only compatible results contain an advisory. The simulator accepts a record ID, never arbitrary procedures.
The store writes one local JSON file atomically. One process owns each file.
All data is synthetic. peaq returns an explicitly simulated receipt without a transaction hash.

## Payment extension

Correction: the statements above describe the original simulator-only API.
VERIFIED source: `src/server.ts` with commerce enabled hides advisories in public queries and requires a paid order for recovery.
`src/economics/chain.ts` implements local EVM and Agung transfers; the legacy simulator still returns explicit mock receipts.
See `docs/payments-contract.md` for current payment endpoints.

## Least confident decisions

1. The force model is constructed and does not describe real robot physics.
2. The local store has one process owner and is not a production database.

## Public preview and readiness snapshot

Interface ID: PREVIEW-1. Owner: coordinator. Status: In Progress.
Provider: src/public-worker.ts and src/server.ts. Consumers: public/app.js.
GET /api/peaqos returns the recorded SDK readiness report, with status, observedAt, preview, machineIdStatus and transactionHash.
A computed ID never attests activation. Local read failures return status unavailable.
Public POST /api/demo/recovery accepts strict context and returns paymentSent false after compatibility checks.
Public /api/orders requests fail with HTTP 403.
Public GET /data/evidence/<allowlisted-report>.json returns committed public evidence only.
No signing keys or bearer order tokens enter the public build.
Verification: tests/public-worker.test.ts and tests/frontend.test.ts.
