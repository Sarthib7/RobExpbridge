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

## Public evidence citations

Owner: implementer. Status: Completed.
V21: The public evidence page makes its inline Markdown citations usable as links. Repository-relative `data/` and `docs/` citations open the committed files on GitHub. HTTPS citations retain their destination. Other link schemes remain escaped text. The raw `/evidence.md` response retains the original document bytes.
Bug record, 2026-10-15: the page escaped the complete document into a plain `pre`, so no citation was clickable. VERIFIED live checks: the evidence block contained zero anchors; cited receipt, RPC-recheck, simulator-run and runbook paths returned HTTP 404 on the public host. This fix changes the public HTML renderer, not the evidence record or payment state.
VERIFIED: the new checks against the original renderer reported `tests 4`, `pass 2`, `fail 2`. The fixed renderer reported `tests 4`, `pass 4`, `fail 0`; type checking exited 0. Built checks verify every relative citation names an existing repository file and preserve raw evidence bytes. Browser inspection found 18 anchors in the evidence block; the paid-run destination displayed the committed JSON on GitHub. The renderer handles inline citations only; remaining Markdown stays source text. These checks do not authenticate historical observations or external RPC evidence.

## EVM fee-cap regression checks

Owner: implementer. Status: Completed.
V22: A funded EVM wallet may sign at the configured maximum fee, but must not sign above it. Broadcasting over-cap signed bytes fails before any RPC call. The fee cap remains 0.01 local ETH or AGUNG; no production parameter changes.
Bug record, 2026-10-15: the earlier fee/funds test used a zero balance, so it passed when the preparation fee-cap guard was removed. New cases isolate the cap from insufficient funds and exercise signed-byte validation separately. These tests use an ephemeral signer and mocked RPC. They submit no public transaction.
VERIFIED: focused EVM checks reported `tests 11`, `pass 11`, `fail 0`; type checking exited 0. Removing the preparation fee-cap guard in a temporary copy produced `tests 11`, `pass 10`, `fail 1`. Removing the signed-byte cap separately produced the same counts. Each mutation exited 1; repository source remained unchanged. Mocked RPC checks do not establish live network behavior.

## Case-study display and chronology review

Owner: implementer. Status: Completed.
V23: Public study percentages reflect the validated report counts, rather than the captured report's particular percentages. A separate synthetic count fixture checks both retrieval and baseline displays. The real dataset, split and captured results remain unchanged.
Bug record, 2026-10-15: original rendering tests checked only the recorded 75% and 35% values. Hard-coded percentages could pass those checks. The study document also labeled its pre-score freeze chronology VERIFIED based on recorded timestamps. Git first stores the manifest and report together in `86ea1d2`; the document now separates reported chronology from verified reproducibility.
VERIFIED: focused public checks reported `tests 5`, `pass 5`, `fail 0`; type checking exited 0. Hard-coding retrieval to 75% in a temporary copy produced `tests 5`, `pass 4`, `fail 1`. Hard-coding the baseline to 35% separately produced the same counts. Each mutation exited 1; repository source remained unchanged. The extra count fixture tests display behavior, not a second dataset result.

## Landing concept motion

Owner: implementer. Status: Implemented; CI and live checks pending.
V24: The landing page has a separate concept animation. It sends no requests or robot commands. It does not supply measured demo results. Pause and manual steps work without starting the recovery demo. Automatic motion stops offscreen, in hidden tabs, and under reduced motion. Without IntersectionObserver, the figure stays still and manual steps remain available.
VERIFIED: the Anatomy skill was installed with `DISABLE_TELEMETRY=1 npx skills add wheresryan22/anatomy --skill anatomy --agent codex --global --yes`. Its `iso-kit.mjs` generated the checked-in SVG. The SVG includes its MIT license. The 64 square solids comprise nine bench parts, 24 parts per Cartesian arm, and seven central review-station parts. Arm assemblies include a mount, two columns, cross rail, stops, guide pads, fixture and jaws, specimen, carriage, reach, ram, palm, fingers and face fasteners. The figure uses straight guides and square solids, with no pipes, cables or turned parts. Its dimensions and motion are illustration choices, not robot specifications.
VERIFIED: focused animation, public-page and guided-demo checks reported `tests 10`, `pass 10`, `fail 0`. Removing the reduced-motion guard in a temporary copy reported `tests 2`, `pass 1`, `fail 1`, exit 1. Browser inspection at 390 pixels reported document width 375 pixels and 64 solid groups. This checks that viewport, not every device or assistive technology. The generated artwork is the editable source asset; rebuilding the site requires no global skill installation.

## Articulated arm story

Owner: implementer. Status: Completed.
V25: The landing illustration uses connected shoulder, elbow and wrist joints. Grippers open and close during a reach and return. The wrist turns to keep the tool upright at the fixture. The lesson card fades between stages and settles at the review station. Reduced motion starts from the static home pose and preserves the pose when the preference changes. One pure pose model drives the projected parts, lesson marker, captions and active stage. The stages are record, check fit, send advice and try locally. Automatic playback continues on hover and focus, as requested. Explicit Pause, reduced motion and hidden/offscreen stopping remain available.
Correction to V24: its Cartesian sliders and three-stage motion describe the earlier illustration. The user requested more recognizable arms and clearer movement. V25 replaces that artwork and sequence. The blue card represents a lesson record, not a physical object. The motion is illustrative; it sends no robot commands and supplies no measured simulator result.
VERIFIED: `public/arm-model.js` supplies the world-coordinate link geometry and projection. The figure has 68 solids: nine bench parts, eight fixture parts, seven review-station parts and 22 parts per arm. Each arm has a mount, pedestal, upper link and rib, forearm and rib, shoulder/elbow housings with caps and square fasteners, wrist housing and cap, ram, palm, fingers and pads. The bench uses Anatomy-generated SVG with its MIT license. Moving paths are calculated from the model. Square housings avoid pipes, cables and turned geometry. The checked-in static pose is tested against the model and remains visible without JavaScript.
VERIFIED: focused checks reported `tests 11`, `pass 11`, `fail 0`. Freezing the runtime pose in a temporary copy reported `tests 3`, `pass 1`, `fail 2`, exit 1. Fixing the jaw gap at its open value separately reported `tests 3`, `pass 2`, `fail 1`, exit 1. It checks fixed link lengths across a sampled loop, finite projected paths, pose continuity, stage/readout agreement and playback controls. These geometry checks do not establish physical robot collision avoidance, control accuracy or safety. Primary implementer owns changes; the planning reviewer has read-only scope.

Least confident decisions:
1. The square joint housings favor clear small-screen shapes over the form of a particular robot model.
2. Five seconds per stage gives readers time to read. User observation may support a different pace.

## Guided demo visual frame

Owner: implementer. Status: Completed.
V26: The public demo has a scoped visual frame. Compact progress tabs retain the active step's `aria-current` attribute. Separate cards display the returned baseline and memory outcomes. The action panel aligns with the top of the fixture illustration. A detailed arm, workbench and fixture replace the earlier sparse drawing. Existing state classes still control slip, matched hardware, rejection and recovery success. Small screens use HTML fixture/lesson labels instead of scaled SVG text.
VERIFIED: changes are limited to `public/index.html`, `public/styles.css`, the public demo body class in `scripts/public-site.ts`, and this contract. `public/app.js`, simulator, matching, payment adapters and dataset files are unchanged. Existing public-page and guided-flow checks reported `tests 8`, `pass 8`, `fail 0`. Browser requests returned baseline `slip · 12 N`, Arm C `incompatible` with `gripper mismatch`, and Arm B `success · 8 N`. These remain constructed simulator results.
VERIFIED: browser inspection at viewport widths 390 and 320 reported document widths 375 and 305, respectively. The 320-pixel check found no main-content element extending past the document width. The fixed action was 48 pixels tall; bottom padding was `100px`. These observations cover the tested viewports with zero safe-area inset, not every device, inset or text-zoom setting. New CSS uses the `demo-workspace` class so it does not style the landing page or local payment workspace.
