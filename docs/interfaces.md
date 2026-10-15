# Simulator contract

VERIFIED source: `src/server.ts` validates experiences and simulation requests with strict schemas.
VERIFIED source: recovery accepts a stored experience ID and rechecks compatibility, expiry, revocation and evidence.
VERIFIED source: missing context returns `requires_review`; hardware mismatch returns `incompatible`.
All outcomes are constructed simulation results. Digests detect record changes; they do not authenticate provenance.

## Least confident decisions

1. The single fixture does not model physical robot performance.
2. The JSON store assumes one process owns each file.

## EVM gateway

VERIFIED source: `src/economics/chain.ts` binds payment evidence to buyer, seller, amount, memo, network and finalized canonical inclusion.
VERIFIED source: `src/economics/wallets.ts` stores generated test-wallet keys in files with mode 0600.
No live transfer is part of CI.

## License orders

VERIFIED source: `src/economics/orders.ts` stores a bearer token, quote, record digest, payment intent and signed bytes before broadcast.
VERIFIED source: retries reuse saved signed bytes; unlock rechecks finality and record compatibility.

## Solana gateway

VERIFIED source: `src/economics/solana.ts` requires the devnet genesis, exact transfer, order memo, signature and finalized RPC evidence.
VERIFIED source: retries broadcast existing signed bytes. Tests use an injected mock transport.

## Local payment API

VERIFIED source: `src/server.ts` restricts the payment service to loopback Host and Origin values and requires `x-experiencebridge-client: local-ui` on mutating requests.
VERIFIED source: order endpoints require bearer tokens. Public experience queries hide the advisory when commerce is enabled.
VERIFIED source: `scripts/payment-demo.ts` exercises quote, payment, retry, finality and recovery on disposable Anvil chain 31337.

## Public simulation UI

VERIFIED source: `src/public-worker.ts` imports simulator and matching code without wallet or signing modules.
VERIFIED source: public recovery returns `paymentSent: false`; order requests return HTTP 403.
VERIFIED source: `scripts/build-public.ts` embeds allowlisted static assets and recorded readiness evidence. The readiness endpoint is a snapshot, not a live activation check.

## peaqOS readiness

VERIFIED source: `scripts/peaqos-check.ts` validates Agung chain and genesis before using the SDK. Activation checks require matching identity and a current subscription.
VERIFIED source: the explicit `--activate` path checks capped bond and gas reserve and writes an exclusive attempt journal. CI calls only deterministic guards and never activates.

## Public batch tooling

VERIFIED source: `scripts/batch-runs.ts` validates the network, count and run ID before creating a report. Exclusive report creation rejects reused run IDs before runtime initialization.
VERIFIED source: report replacement uses a synced temporary file and rename. Rows with blocked or unknown payment outcomes are not reported as successful.
CI exercises invalid configuration and existing-report paths only; it does not run a funded public batch.

## Public request body boundary

Owner: implementer. Status: Completed.
V12: Public POST handlers read at most 16,384 request bytes before parsing JSON. Once a chunk crosses that limit, they cancel the remaining stream and return HTTP 413. A body at the limit remains valid when its JSON and route schema are valid.
VERIFIED source before fix: `src/public-worker.ts` called `request.text()` before checking `text.length`. That buffered the full request and counted UTF-16 code units.
This bound limits application buffering; a single transport chunk can already exceed the limit before the reader receives it.

VERIFIED: `tests/public-worker.test.ts` collected 6 tests, 6 passed, 0 failed. Restoring the original source kept 6 collected tests, with 3 passed and 3 failed. The fixed source was restored. `npm run build:public` exited 0.

## Local EVM startup boundary

Owner: implementer. Status: Completed.
V13: `scripts/local.ts` validates `PORT` as an integer from 1024 through 65535 before starting Anvil or creating any data directory, wallet or runtime lock.
VERIFIED source before fix: the script called `startLocalNode` and `createRuntime` before converting `PORT` at `listen`. Invalid configuration could create runtime state before failing.
An occupied valid port is still detected at listen time; this invariant covers invalid configuration, not port reservation.

VERIFIED: startup tests collected 5 tests; original source produced `pass 1`, `fail 4` because each invalid port created `data`. The fixed source produced `pass 5`, `fail 0`; type checking exited 0. The tests hide Anvil from PATH and do not submit payments.

## Offline robot-failure case study

Owner: implementer. Status: Completed.
The `case-study:robot` command reads only the pinned Kaggle LP1 CSV, original UCI LP1 label file and manifest. It returns a JSON report of diagnosis retrieval versus a reference-majority baseline. It imports no payment runtime or controller.
Reference/query partitions contain whole unique episodes. Channel scales use reference samples only. Every query returns a source reference ID, distance and class prediction, not an executable advisory.
Input failures: mismatched source hashes, invalid shapes, non-integer values, missing labels, mismatched Kaggle/UCI rows or duplicate traces stop the run.
VERIFIED source limits: post-failure measurements lack established robot model, gripper, fixture and successful-recovery outcomes. They remain outside the synthetic experience schema.

VERIFIED: focused case-study checks reported `tests 8`, `pass 8`, `fail 0`; TypeScript checking exited 0. A zero-distance regression produced `tests 1`, `pass 0`, `fail 1`, exit 1; the source was restored.

V14: The frozen study reproduces the committed reference/query episode IDs and every query-to-reference prediction mapping, not only aggregate accuracy. Tests compare these fields with the recorded report.
