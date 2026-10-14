# Decisions

2026-10-13. Owner: coordinator.

INFERRED: Use the existing mvp.md scope, Fastify, Zod and a local JSON file. No real settlement or TEE integration is required for the synthetic core.
VERIFIED: `src/memory/match.ts` supports only one replayed attempt and one success. Other evidence labels cannot qualify.
VERIFIED: Store serialization covers one Store instance. One process and one writer must own a file.

## Bug record

B1, owner coordinator: VERIFIED, initial type check reported `TS2322: Type 'unknown' is not assignable to type 'InjectPayload | undefined'`.
Cause: helper input was passed directly to Fastify injection. Fix: serialize input as JSON with a content-type header.

B2, owner coordinator: VERIFIED, tsx CLI reported `listen EPERM` for its IPC pipe in the sandbox.
Fix: use `node --import tsx`, which passed the tests without that pipe.

B3, owner coordinator: VERIFIED, the V1 test returned `actual: 'compatible', expected: 'rejected'` for inflated counts.
Correction: the first matcher accepted equal counts although it replayed only one attempt. The fixed gate requires exactly 1/1.
V1 invariant: one fixed simulator replay cannot attest multiple attempts. Test: `tests/core.test.ts`.
V2 invariant: simulation rejects expired, revoked or inflated stored evidence. Test: `tests/api.test.ts`.
No SPEC.md exists. Existing mvp.md and vision.md remain unchanged.

## Payment review invariants

V3 invariant: one runtime owns each network data directory. Test: `tests/runtime.test.ts`.
V4 invariant: invalid startup configuration must not acquire a persistent runtime lock. Test: `tests/startup.test.ts`.
V5 invariant: failed payment or access rechecks must hide earlier advisory and recovery results. Test: `tests/frontend.test.ts`.
REPORTED review findings: port validation followed lock acquisition; frontend failures could retain earlier successful results.
VERIFIED: focused fixes are present; final `npm test` printed `tests 40`, `pass 40`, `fail 0`. Public testnet funding remains unresolved.

## Public setup checkpoint

2026-10-13. Owner coordinator.
INFERRED decision: host the constructed preview separately from the local custodial payment service.
The user authorized Cloudflare hosting and chose to leave live runs blocked while setup continues.
VERIFIED source: public-worker imports simulator and matcher only, with no payment signing surface.
REPORTED UI-6 regression: a failed public compatibility recheck retained recovery eligibility. Reset eligibility before requesting a new match.
V6 invariant: devnet payment verification checks exact transfer, memo, fees and finality. Tests: solana.test.ts and orders.test.ts.
V7 invariant: peaqOS preview and computed identity never imply activation. Tests: peaqos.test.ts.
V8 invariant: public preview cannot sign payments and only returns recovery for compatible context. Tests: public-worker.test.ts.

## Least confident decisions

1. The fixed force model proves flow only. Real robot transfer remains untested.
2. Atomic rename and one writer are adequate for this local demo. Power-loss durability remains untested.
