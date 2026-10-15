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

V15: The offline CLI rejects altered source bytes, a changed frozen protocol and Kaggle/UCI misalignment before emitting any report. CLI tests invoke a copied command with isolated input files; helper-only tests do not satisfy this invariant.
Bug record, 2026-10-15: removing both CLI integrity-check calls left the original eight helper/evaluation tests passing. The missing command-level checks caused this coverage gap.

## Public recorded-data panel

Owner: implementer. Status: Completed.
V16: The built public demo shows recorded diagnosis results and an accessible flow diagram from the committed report. It publishes the raw report and source manifest, rejects inconsistent counts during rendering, and keeps payment orders blocked. Diagnosis is not described as recovery success, pre-failure prediction or robot safety.
Input: `data/evidence/robot-failure-case-study-20261015.json`, read at build time. Output: static HTML, raw report JSON and source manifest JSON. No signing, dataset ingestion or controller route is added.

VERIFIED V16 checks: built-Worker tests reported `tests 2`, `pass 2`, `fail 0`; a temporary wrong-score mutation produced `tests 2`, `pass 1`, `fail 1`, exit 1. Rendering checks summary counts against prediction rows. Desktop and 390-pixel browser checks showed the table and flow diagram without horizontal clipping.

## Guided public demo

Owner: implementer. Status: Completed.
V17: Public visitors see one active demo step: baseline, compatibility or recovery. The baseline action loads the synthetic sample and measures it. Only a compatible selection advances to recovery. Failed requests leave a usable retry, and restart clears displayed outcomes. Local paid workspaces retain separate publish/baseline actions and their existing payment gates.
The public page keeps simulation limits and case-study limitations visible. Hardware criteria, recorded-study method and peaqOS snapshot details use native disclosures. Public wallets and duplicate workflow navigation are outside the primary path.
Verification uses the shipped browser handlers with the real public Worker. The test DOM does not measure CSS, focus or responsive layout; browser checks cover those surfaces.

VERIFIED V17 checks: guided-flow tests reported `tests 3`, `pass 3`, `fail 0`; combined public checks reported `tests 5`, `pass 5`, `fail 0`. Type checking exited 0. With the old browser handlers, the new flow tests reported `tests 3`, `pass 1`, `fail 2`. A temporary mutation that advanced incompatible hardware reported `tests 3`, `pass 2`, `fail 1`. Both exited 1; repository source remained unchanged.
VERIFIED browser checks at 375, 768 and 1280 pixels: document width did not exceed viewport width. Keyboard Enter advanced to the compatibility heading, which received focus. The simulation performance/safety limit remains visible outside collapsed content. REPORTED independent review: both identified issues (hidden limit and stale repeated-recovery outcome) were addressed; no defect found in those fixes.

## Public schematic

Owner: implementer. Status: Completed.
V18: The public illustration follows baseline, compatibility and recovery responses. It distinguishes an incompatible match from a failed request, clears prior results on restart or hardware change, and shows success only after a successful simulation response. Force values are labeled simulated settings or simulated force. The illustration is not robot telemetry and issues no commands.
The scene is hidden in local paid workspaces. Text captions carry the outcome without relying on color or motion. CSS motion is optional under `prefers-reduced-motion`.

VERIFIED V18 checks: combined public tests reported `tests 5`, `pass 5`, `fail 0`; type checking exited 0. Three separate temporary mutations (premature success, wrong blocked state and missing hardware reset) each produced `tests 3`, `pass 2`, `fail 1`, exit 1. Repository source remained unchanged. Browser checks at 375, 768 and 1280 pixels showed the schematic and readable status captions. Motion uses a CSS preference guard; forced reduced-motion emulation was not tested. REPORTED independent review: explicit simulation labels and immediate reset assertions addressed both findings.
VERIFIED CI finding: run `38727573402` collected 96 tests with 90 passed and 6 failed because the legacy public browser harness lacked `setAttribute`. Its body class support was also missing. The harness now implements the required DOM methods and asserts successful startup, rather than allowing a caught setup error. Combined frontend/public checks reported `tests 14`, `pass 14`, `fail 0`; type checking exited 0. Removing the body fixture in a temporary copy produced `tests 9`, `pass 3`, `fail 6`, exit 1.

## Public showcase navigation

Owner: implementer. Status: Completed.
V19: Build-time public pages share a header with native links and one current-page marker. The root remains the synthetic demo. `/showcases` lists only the implemented recovery demo and recorded diagnosis study. `/case-study` carries the validated report, limits, diagram and source links. The root retains its `#case-study` anchor as a short link to that page. `/evidence` displays escaped evidence text; `/evidence.md` retains the raw document. Static pages load no demo handlers.
Input: the existing demo template, validated study report and evidence document. Output: HTML assets with the existing Worker security headers. Unknown routes stay 404. Local paid workspace markup, payment gates and dataset files stay unchanged.
VERIFIED: combined frontend, public-flow and built-Worker checks reported `tests 15`, `pass 15`, `fail 0`; type checking exited 0. In temporary copies, a broken study link and unescaped evidence each produced `tests 3`, `pass 2`, `fail 1`, exit 1. Repository source remained unchanged. Browser checks at 375 pixels showed no horizontal overflow on the catalog, study or evidence page. Desktop checks showed the two-card catalog and shared header. Returning through the header ran the baseline and displayed `slip · 12 N`. REPORTED independent read-only review: no concrete route, claim or accessibility defect found. Primary implementer owns all code.

## Visual overview landing page

Owner: implementer. Status: Completed.
V20: `/` explains exbridge with an accessible schematic, About section and links to the implemented showcases. It loads no demo handlers. `/demo` carries the existing working synthetic demo and security boundaries. All demo entry links use `/demo#demo`. Legacy root fragments `#main`, `#demo` and `#case-study` still resolve to relevant overview sections. No physical robot, production activation or privacy claim is added.
Input: existing demo template and static overview copy. Output: build-time HTML using the shared header and styles. `/demo/` aliases `/demo`; unknown routes remain 404. Dataset and payment behavior stay unchanged.
Correction to V19: its root-as-demo route described the previous design. The user requested an explanatory landing page, so V20 replaces that routing choice. Existing root fragments now land on overview content; explicit demo links open `/demo#demo`.
VERIFIED: combined public/frontend checks reported `tests 15`, `pass 15`, `fail 0`; type checking and diff whitespace checks exited 0. A temporary copy with only the prior source restored kept the new tests and reported `tests 3`, `pass 2`, `fail 1`, exit 1. Repository source remained unchanged. Desktop browser checks showed the two-machine schematic. At 375 pixels, the overview width did not exceed the viewport. Header navigation opened `/demo#demo`; the baseline returned `slip · 12 N` and recovery returned `success · 8 N`. These are constructed simulator results. Primary implementer owns all code; reviewer has read-only scope.

REPORTED review finding: SVG labels became too small when scaled to mobile width. VERIFIED resolution at a 375-pixel viewport: SVG text has computed `display: none`; the adjacent HTML legend has computed `display: flex` and `font-size: 12px`. The figure caption remains the accessible text equivalent. Content width remained 360 pixels. This browser check covers that viewport, not every device or zoom setting.
