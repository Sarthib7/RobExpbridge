# Release slices

2026-10-14. Owner: release. Status: In Progress.

REPORTED user request: split the preserved checkpoint into small PRs and merge each after passing CI.
VERIFIED baseline: `b0fcd55`. Preserved checkpoint: `b654d92`.
Planned order: core recovery, EVM orders, Solana gateway, public interface, peaqOS checks, release material.
Current scope: simulator, schema, store, API, deterministic tests and CI.
Next action: verify core behavior and open its PR.
VERIFIED core checks: `npm run check` exited 0; `npm test` printed `tests 15`, `pass 15`, `fail 0`; `npm run demo` exited 0.
VERIFIED regression proof: widening baseline success to 12 N made the focused behavior test print `tests 1`, `pass 0`, `fail 1` and exit 1. Source restored afterward.

VERIFIED: PR #9 merged as `c54de87` after Node 22 and 24 checks passed on `12091b2`.
Current scope: EVM gateway, test-wallet storage and RPC behavior tests. Owner: release. Status: In Progress.
VERIFIED EVM checks: `npm run check` exited 0; gateway tests printed `tests 9`, `pass 9`, `fail 0`.
VERIFIED regression proof: bypassing finality produced `tests 1`, `pass 0`, `fail 1`; restored source produced `tests 1`, `pass 1`, `fail 0`.
VERIFIED: live `/health` returned HTTP 200 with `paymentSigning: false` after the core merge.

VERIFIED: PR #10 merged as `64a8d27` after Node 22 and 24 CI passed on `e6a4342`. Live `/health` returned HTTP 200.
Current scope: durable license-order state machine and deterministic tests. Owner: release. Status: In Progress.
VERIFIED order checks: type checking exited 0; order tests printed `tests 13`, `pass 13`, `fail 0`.
VERIFIED regression proof: bypassing access-time finality produced `tests 1`, `pass 0`, `fail 1`; restoring it produced `tests 1`, `pass 1`, `fail 0`.

VERIFIED: PR #11 merged as `ab6dc86` after Node 22 and 24 checks passed on `9aec046`. Live `/health` returned HTTP 200.
Current scope: Solana devnet gateway, restricted test-wallet storage and mocked RPC tests. Owner: release. Status: In Progress.
VERIFIED Solana checks: type checking exited 0; adapter tests printed `tests 7`, `pass 7`, `fail 0`.
VERIFIED regression proof: using confirmed instead of finalized transaction evidence produced `tests 1`, `pass 0`, `fail 1`; restoring it produced `tests 1`, `pass 1`, `fail 0`.

VERIFIED: PR #12 merged as `1b3a713` after Node 22 and 24 checks passed on `e0c1377`. Live `/health` returned HTTP 200.
Current scope: local payment API, single-owner runtime, startup validation and disposable Anvil demonstration. Owner: release. Status: In Progress.
VERIFIED API/runtime checks: type checking exited 0; focused tests printed `tests 7`, `pass 7`, `fail 0`.
VERIFIED local Anvil demo: `payment: confirmed`, `sellerReceived: 0.001 local ETH`, `baseline: slip`, `recovery: success`, `retry: same signed transaction, seller paid once`.
VERIFIED regression proof: creating the runtime before validating PORT produced `tests 1`, `pass 0`, `fail 1`; restoring startup order produced `tests 1`, `pass 1`, `fail 0`.

VERIFIED: PR #13 merged as `bf21436` after Node 22 and 24 CI passed on `8fd3766`, including the disposable Anvil demo. Live `/health` returned HTTP 200.
Current scope: preserved landing design, public simulator, static build, recorded evidence and frontend behavior tests. Owner: release. Status: In Progress.
VERIFIED public checks: type checking, public build and frontend syntax exited 0; focused tests printed `tests 10`, `pass 10`, `fail 0`.
VERIFIED regression proof: hiding compatible public recovery produced `tests 1`, `pass 0`, `fail 1`; restoring the controls produced `tests 1`, `pass 1`, `fail 0`.

VERIFIED: PR #14 merged as `ae4d7b3` after Node 22 and 24 CI passed on `435875f`.
Current scope: peaqOS guard tests, persistent verification key and activation evidence, SDK dependency and explicit commands. Owner: release. Status: In Progress.
VERIFIED: live HTML and CSS matched the merged public design after PR #14.
VERIFIED peaqOS checks: type checking exited 0; guard tests printed `tests 6`, `pass 6`, `fail 0`.
VERIFIED regression proof: removing the gas reserve produced `tests 1`, `pass 0`, `fail 1`; restoring the guard produced `tests 1`, `pass 1`, `fail 0`.
No activation, public payment or SDK network check was submitted in this slice.

VERIFIED: PR #15 merged as `96084ca` after Node 22 and 24 checks passed on `0196a5d`. Live `/health` returned HTTP 200.
Current scope: offline constructed batch report and its deterministic CI check. Owner: release. Status: In Progress.
VERIFIED offline batch check: type checking exited 0; report printed `total: 12`, `passed: 12`, `failed: 0`, `paymentTransactions: 0`.
VERIFIED regression proof: an incorrect expected expiry verdict printed `total: 12`, `passed: 11`, `failed: 1` and exited 1. Restored source exited 0 with all 12 checks passed. Historical report bytes were restored after verification.

VERIFIED: PR #16 merged as `133e017` after Node 22 and 24 CI passed on `1eea76c`. Live `/health` returned HTTP 200.
Current scope: public batch CLI, read-only balance command, and deterministic CLI guards. Owner: release. Status: In Progress.
VERIFIED CLI checks: type checking exited 0; CLI tests printed `tests 3`, `pass 3`, `fail 0`.
VERIFIED regression proof: replacing exclusive report creation with truncating creation produced `tests 1`, `pass 0`, `fail 1`; restored source produced `tests 1`, `pass 1`, `fail 0`.
All CLI test cases reject arguments, reuse an existing report, or fail the HTTPS configuration guard before network access. No public testnet batch was run.


## Repository readiness, 2026-10-14

Owner: coordinator. Status: In Progress.
REPORTED user request: improve repository presentation and production readiness.
Scope: README and setup first; CI controls second; request or startup hardening after a read-only audit.
Owner boundaries: coordinator owns all edits. Reviewer audits source and tests without editing. No API contract change is planned.
VERIFIED: PR #19 is merged at `7af93bf`; Node 22 and 24 PR checks ran 70 tests, 70 passed, 0 failed on `a504909`.
VERIFIED: browser baseline returned `slip`, `12 N`, `seed 7`, `fixture-7`; Arm C returned `incompatible`, `gripper mismatch`. No new payment was sent.
VERIFIED: corrected README query returned HTTP 200 with `exp-001`, `compatible`.
VERIFIED: `npm audit --omit=dev --json` returned `total: 0` advisories. Advisory coverage does not prove application security.
Next: validate documentation and publish one README PR, then review CI and runtime findings.

### Least confident decisions

1. The next hosting target is not specified. Signing remains local; the public Worker stays unsigned.
2. JSON storage remains acceptable only for the single-runtime testnet demo. Shared production use needs a separate design.

VERIFIED: README PR #20 merged as `aa69d10` after Node 22 and 24 CI passed on `30291a2`.
VERIFIED: local and public `/health` returned `status: ok`; public response included `paymentSigning: false`.
Owner: release. Status: In Progress. Scope: CI permission limits, immutable action references, timeout and dependency audit gate.
VERIFIED: GitHub commit API resolved action tags: checkout v4 `11d5960a326750d5838078e36cf38b85af677262`, setup-node v4 `49933ea5288caeca8642d1e84afbd3f7d6820020`, Foundry v1 `908c540300062bd5a7e473851cdb4282204cee09`. Pinning these references does not audit their contents.

VERIFIED: CI PR #21 merged as `0ad0709` after Node 22, Node 24 and dependency audit checks passed on `7fef59c`.
Owner: implementer. Status: In Progress. Scope: public Worker byte limit and deterministic regression checks.
VERIFIED before source fix: public Worker tests printed `tests 5`, `pass 3`, `fail 2`; oversized streams were not cancelled, and a multibyte oversized body returned 400 instead of 413.
VERIFIED after initial fix: focused tests printed `tests 5`, `pass 5`, `fail 0`; `npm run check` exited 0.

VERIFIED final request-limit proof: focused checks reported `tests 6`, `pass 6`, `fail 0`; original source with those checks reported `tests 6`, `pass 3`, `fail 3`, exit 1. Fixed source restored. Public build exited 0.

VERIFIED: public body-limit PR #22 merged as `76259e9` after Node 22, Node 24 and dependency audit checks passed on `7817301`.
VERIFIED: repository About metadata now has a simulator description, `https://exbridge.world` homepage and five relevant topics, confirmed by `gh repo view`.
Owner: implementer. Status: In Progress. Scope: local EVM startup port validation.
VERIFIED: startup tests with original source collected 5 tests, `pass 1`, `fail 4`; invalid ports created a `data` directory. Fixed source collected 5 tests, `pass 5`, `fail 0`. Type checking exited 0.

## Readiness handoff

2026-10-14. Owner: coordinator. Status: Completed (implementation).
VERIFIED: presentation and setup corrections are in merged PR #20. CI controls are in merged PR #21. The bounded public request reader is in merged PR #22.
VERIFIED: local startup port validation and its regression checks are committed on PR #23. GitHub records its release checks and merge result.
VERIFIED: local and public health checks returned `status: ok` after PR #22; the public preview returned `paymentSigning: false`. These health responses do not prove the newly merged Worker source has been deployed. No Worker deployment was made in this readiness pass.
VERIFIED: no wallet files, payment evidence or robot procedures were changed by this pass. Source changes only affect request parsing and invalid-port startup.
REPORTED: peaq faucet maintenance blocks user funding. No peaqOS activation is established.
Follow-up: deploy the bounded public Worker; obtain AGUNG and separately approve activation. A shared payment service needs a custody and authentication design plus transactional storage. Current signer services remain local testnet demos.

## Public release, 2026-10-15

Owner: release. Status: Completed.
Correction to the prior handoff: public deployment was pending on 2026-10-14. It is now verified live.
VERIFIED: merged source `6ba2f4b` built artifact SHA-256 `674ec45c17249bd15973cf132cf045cb61ac0f3f6f2f7c07cba8099ac35a39f3`.
VERIFIED Cloudflare deployment: `112f02ec-3cff-4b0e-8df5-c7734ead9e99`, version `ccb7486e-3027-4f9e-9150-2598a405759e`, 100 percent traffic, created `2026-10-15T08:52:50.910075Z`. Compatibility date and flags remain `2026-10-13`, `nodejs_compat`; bindings remain empty.
VERIFIED live checks: HTML, JavaScript and CSS matched merged source byte for byte; 16,384-byte body returned HTTP 200; oversized UTF-8 body returned HTTP 413; Arm C returned HTTP 422; orders returned HTTP 403.
VERIFIED simulator: baseline `slip`, recovery `success`, `paymentSent: false`. Health returned `paymentSigning: false`.
Evidence: `data/evidence/public-release-20261015.json`. These checks cover the unsigned synthetic preview, not a shared signing service or real robot performance.
Remaining blocker: AGUNG funding and separately approved peaqOS activation.

## Recorded robot-data case study, 2026-10-15

Owner: implementer. Status: In Progress.
REPORTED user request: use Kaggle or Hugging Face data and run test cases for a case study.
Scope: isolated offline LP1 diagnosis retrieval, pinned public data, deterministic tests and case-study evidence. No API or simulator schema change.
Owner boundaries: implementer owns all edits; reviewer only audits data provenance, leakage and result interpretation.
VERIFIED: Kaggle version 1 contains six numeric columns without labels. All five files match the original UCI numeric rows exactly. LP1 has 88 distinct 15-by-6 traces; labels come from the original only after exact trace alignment.
VERIFIED exploratory probe: 68 reference episodes, 20 query episodes; retrieval `15/20`, majority baseline `7/20`; three faulty queries were called normal. This is post-detection diagnosis, not recovery effectiveness or safety.
Next: freeze the original probe protocol, add offline reproducibility checks and record all errors without tuning the split.

VERIFIED implementation: `npm run check` exited 0. Case-study tests reported `tests 8`, `pass 8`, `fail 0`. Replacing candidate distance with zero produced `tests 1`, `pass 0`, `fail 1`, exit 1; restoring the source returned eight passing tests.
VERIFIED independent replay: Python and TypeScript agree on reference/query IDs, all predictions and all metrics. Recorded report: `data/evidence/robot-failure-case-study-20261015.json`.
VERIFIED rights and source notices: original UCI license is CC BY 4.0; the Kaggle catalog lists CC0. This package retains original attribution and explicitly records that difference.
Blocked: automatic approval review rejected appending case-study links to user-authored README.md and evidence.md without explicit approval. Those two files remain unchanged; the standalone document is `docs/case-studies/robot-failures.md`.
Next: review the isolated research tool and merge its single feature PR only after exact-head CI passes.

REPORTED independent review: pin the split IDs and per-query prediction mapping, since equal aggregate metrics alone cannot prove the frozen partition. VERIFIED implementation: the test now compares those fields directly with the committed report.

VERIFIED source byte protection: `git check-attr text` returned `text: unset` for both retained LP1 files. Scoped attributes preserve the downloaded line endings.
REPORTED independent final review: no other actionable correctness, leakage or misleading-claim issue was found. The split-ID finding was addressed and all eight focused checks passed again.
Implementation status: Completed. Release status: In Progress until exact-head CI and sequential merge.

## Case-study review resolution, 2026-10-15

Owner: reviewer. Status: Completed.
Correction to the earlier handoff: case-study PR #28 merged as `86ea1d2fb34446aa6d9bf859e23df4cfdea29ee8`. Approved README/evidence updates merged in PR #29 as `92e05ef03b671536c0ff95652f3cee66c6e527f3`. The earlier document-edit blocker is resolved.

VERIFIED finding: removing both CLI calls to `verifyManifestFile` in a temporary copy left the original checks at `tests 8`, `pass 8`, `fail 0`. The source already called the checks. Helper tests did not protect command wiring.
VERIFIED resolution: `tests/robot-failure-cli.test.ts` adds five CLI tests under invariant V15 in `docs/interfaces.md`. They cover the intact report, changed bytes in either source, a changed protocol and misaligned CSV rows. Combined focused checks reported `tests 13`, `pass 13`, `fail 0`; `npm run check` exited 0.
VERIFIED mutation proof: removing integrity calls produced `tests 5`, `pass 3`, `fail 2`. Removing protocol validation or alignment separately produced `tests 5`, `pass 4`, `fail 1`. Each mutation exited 1; repository source remained unchanged.
REPORTED independent fix review: no defects found. The reviewer checked isolated command execution and the purpose of each corruption case.

VERIFIED release: [PR #30](https://github.com/Sarthib7/RobExpbridge/pull/30) merged as `dadf52502a4c8295cab3bb7e86cb53818eaa6406`. [CI run 38722591505](https://github.com/Sarthib7/RobExpbridge/actions/runs/38722591505) passed Node 22, Node 24 and dependency audit checks on `72c0b6dae285fad190aa1807eeb572e0552f6f59`. Node 22 output reported `tests 91`, `pass 91`, `fail 0`. This verifies the tests, not physical robot performance.
VERIFIED source audit: a fresh UCI archive download matched SHA-256 `cdfbe0b260f4a21c5249fe0da4b1baf4041959663a9182253885ee1f41a4568e`. Retained data files matched their recorded archive members. A CLI rerun matched every saved report field except `observedAt`. These checks do not verify the original laboratory collection.

Remaining limits: local checksums trust the committed manifest. Missing robot, site and session metadata prevents evaluation across those groups. Recorded diagnosis does not establish recovery success or safety.
Follow-up: no remaining CLI coverage fix. AGUNG funding and separately approved peaqOS activation remain outside this review. No dataset, wallet, payment or deployment change occurred.

## Microduck experiment, 2026-10-24

Owner: implementer. Status: Blocked.
VERIFIED approval: the user approved architecture revision R1 before implementation.
VERIFIED checkout: `feat/microduck-shared-failures`, based on `096e2bf`.

VERIFIED source: `experiments/microduck/` adds an isolated Python 3.12 environment,
immutable failure lessons, strict compatibility and partition checks, actual
MuJoCo/BAM episodes, an upstream PPO worker and explicit comparison commands.
The connector schema, HTTP routes, public UI, wallets and payment code are unchanged.
`README.md` and `docs/interfaces.md` contain the commands and V28-V31 contracts.
`.github/workflows/test.yml` adds a CPU job without GPU spending or deployment.

VERIFIED local command:
`uv run --frozen --project experiments/microduck --group test python -m unittest discover -s experiments/microduck/tests -v`
with `MICRODUCK_SOURCE` set to the pinned checkout reported `Ran 21 tests` and `OK`.
The suite exercised real physics resets, ONNX shape/action rejection, memory
integrity, expiry, incompatible actuators, held-out-case leakage and comparison
failure paths. Test fixtures labeled as validator or untrained boundary probes
are not learning evidence.

VERIFIED negative controls: disabling digest comparison, the sustained-hold
requirement or pair rejection in separate disposable copies each reported
`Ran 21 tests`, `FAILED (failures=1)`, exit 1. Repository source was not mutated
by those controls. The disposable copies were removed afterward.

VERIFIED `run.py setup`: fetched upstream
`b02fdea4902c2b93b7d34a83a6f05da4ececb7d3`.
VERIFIED `run.py smoke --render`: wrote four real episode traces and PNGs under
`data/local/microduck/final-smoke/`. Each episode recorded 300 control steps and
`simulatedSeconds: 5.999999999999894`. All hold-home probes returned
`not-recovered`; `learningMeasured` was `false`.
VERIFIED additional untrained ONNX runtime probe: 300 control steps,
`outcome: "not-recovered"`. No recovery or learning gain is claimed.
VERIFIED preserved connector smoke: `npm run demo` exited 0 and retained the
constructed slip/recovery, incompatible-hardware rejection and simulated receipt.

Blocked: the real CUDA learning comparison has not run. The CPU guard returned
`CUDA_TRAINING_UNAVAILABLE` and created no run directory. No NVIDIA worker or
paid compute budget is selected. No trained donor was fabricated, no hosted
job was submitted, and this branch has not been pushed.
UNKNOWN runtime: PPO updates, a newly trained normalizer-preserving ONNX export,
CPU/CUDA agreement and donor-to-receiver learning improvement.
The GitHub workflow has not run on this change.

Next: select an approved NVIDIA CUDA worker and its interaction/time budget.
Run the documented donor and matched receiver experiment, then record every
paired outcome, including unchanged or worse results. Robot STL assets use
CC BY-NC-SA 4.0; commercial use needs a separate rights decision.

VERIFIED user decision: selected `Pause after local verification`.
The CUDA comparison is paused by request, not completed. No GPU job is queued.
Keep local code and CPU evidence. Resume only after the user selects compute.

## Microduck publication checkpoint, 2026-10-24

VERIFIED user authorization: commit, push and merge small PRs, then wrap up.
Correction: the local-only and unrun-CI statements above describe the earlier
verification checkpoint. The source is now published through sequential PRs.

VERIFIED merged slices and their passing exact-head CI runs:

- PR #45, failure memory: head `8926fe41c8111526635ad1994d24fd839264553a`,
  CI `40135642282`, merge `c7fdc7c52c6778c747ab2ef07190d9199cf08075`.
- PR #46, CPU simulation: head `b9352e94c57884bc4689261482d9171f900df795`,
  CI `40135806206`, merge `79e7682f59797dbc6ee81335ac3740563d73bbc1`.
- PR #47, CUDA worker: head `5694143163baba96ece9e2f7235ebea1a7f2b958`,
  CI `40135932293`, merge `46671f1b0db3049f920941a7481956d537eda955`.

VERIFIED post-merge checks used a checkout of the merged source.
The memory smoke rejected a changed record. The CPU simulator completed all
four starting families at 300 control steps each. The worker returned
`CUDA_TRAINING_UNAVAILABLE`, exit 1, without creating its output directory.
None of those checks establishes a learning gain.

This entry precedes the final orchestration PR. GitHub records its exact-head
CI and merge outcome; this source document does not claim a future merge.
CUDA learning remains paused by request. No paid job, physical-robot command,
peaq activation or application deployment is included in publication.
