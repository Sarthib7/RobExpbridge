# Status

2026-10-13. Owner: coordinator. Core MVP: Completed.

VERIFIED: `npm run check`, `npm run build` and `npm run demo` exited 0.
VERIFIED: `npm test` printed `tests 15`, `pass 15`, `fail 0`.
VERIFIED clean copy at `/var/folders/71/y9gh4tjx2b3915b_ktq6lqc00000gn/T/eb-clean-v2jm6ca1`: `npm ci --ignore-scripts --prefer-offline`, `npm test` and `npm run demo` exited 0. Tests printed `tests 15`, `pass 15`, `fail 0`.
VERIFIED demo: baseline `slip`, recovery `success`, Arm C `gripper mismatch`, `tamperingDetected: true`, peaq `status: simulated`, `transactionHash: null`.

VERIFIED negative checks, before final count tests: five deliberate source mutations each made `npm test` exit 1 with `tests 13` collected.
Recovery mutation: `pass 7`, `fail 6`. Digest mutation: `pass 11`, `fail 2`.
Compatibility mutation: `pass 10`, `fail 3`. Expiry mutation: `pass 11`, `fail 2`.
Evidence mutation: `pass 11`, `fail 2`. All source mutations were restored.
VERIFIED V1 regression before fix: `tests 1`, `pass 0`, `fail 1`; actual compatible, expected rejected.

VERIFIED scope: simulator, schema, store, matcher, API, synthetic settlement receipt, CLI demo, behavior tests and CI workflow exist.
VERIFIED prose detector: README.md, docs/interfaces.md and docs/decisions.md each returned `[]` issues.
INFERRED limits: one process and one Store writer; local synthetic use only. Real robot transfer and power-loss durability are untested.
Git and remote CI: Blocked, owner coordinator. See agents/blockers.md. No commit, push, deployment or payment occurred.
Next action: run `npm run demo` in the project folder.

## Payment MVP update, 2026-10-13

Correction: the earlier statement that no payment occurred describes the initial simulator stage only.
VERIFIED: the completed local payment example sent a real transaction on disposable chain 31337.
Hash: `0x0733779b14b48681638e03970eb6e41692d23d442835ef5c1357cf8c0da3964e`.
`npm run demo:payments` exited 0 with `payment: confirmed`, `sellerReceived: 0.001 local ETH`, `baseline: slip`, `recovery: success`, and `retry: same signed transaction, seller paid once`.
VERIFIED: `npm test` printed `tests 36`, `pass 36`, `fail 0`.
`npm run check`, `npm run build`, and `node --check public/app.js` exited 0.
These local checks do not prove public testnet settlement.

VERIFIED browser flow: publish, baseline slip, compatible quote, payment confirmation, recovery success and Arm C rejection.
After a graceful server restart, the browser restored its confirmed order and unlocked the advisory.
Persistent local demo hash: `0x5636d12963828069b8c1fbeeca14950c53dae218240b7380b8ca7b3bad379ccc`.
VERIFIED negative check: disabling the saved-transaction guard made the concurrent payment test print `tests 1`, `pass 0`, `fail 1`. Source restored.
REPORTED by payment agent: removing finality enforcement made its focused finality test fail. Coordinator did not repeat that mutation.

VERIFIED Agung RPC: chain `0x2706`; properties `{tokenDecimals:18,tokenSymbol:'AGUNG'}`; finalized block lookup returned a block.
Buyer: `0xb1B6938BAcEAAe2007Ce26D8ad248d54F25c0fB1`.
Contributor: `0x6E15b13aB2E3d8baBaf9d19736704f3034691C7c`.
The faucet alert claimed funding with hash `0xeec5c3ccb5cdb01f51d537d0cb78d45e79ca35a50da7bb5686e37b917e3fb689`.
Both official RPC endpoints returned balance `0x0`; receipt and transaction queries returned `null`.
The explorer displayed `was not found on the agung network` for that hash.
No Agung payment was sent. Faucet failure cause is not determined.

Local UI: `http://127.0.0.1:3333`. Agung UI: `http://127.0.0.1:3334`.
Next action: use the local UI now; obtain faucet funding before attempting public testnet settlement.

## Final review checks

VERIFIED: final `npm test` printed `tests 40`, `pass 40`, `fail 0`. Type check, build and frontend syntax check exited 0.
REPORTED agent regression proofs: V4 failed with the old startup order and passed after the fix; V5 collected three failures without the display reset and three passes after restoration.
VERIFIED source inspection: port validation now precedes runtime creation; frontend verify, unlock and recovery clear earlier results before requests.
VERIFIED Agung browser failure: `No transaction was prepared`, order remained `quoted`, and no transaction hash appeared.
REPORTED official-source research: the faucet accepts EVM H160 addresses; no conversion is required. No alternate official faucet was found in the focused lookup.
Follow-up: request help through peaq's official community with the public address and faucet hash if funding remains unavailable.

## Institutional interface update

2026-10-13. Owner: coordinator. Branding and UI: Completed.
VERIFIED source: `public/index.html` and `public/styles.css` now provide a navy navigation rail, bridge mark, structured workflow and wallet panel.
The faucet link now sits beside the buyer wallet. `brand.md` records the visual rules.
VERIFIED: `node --import tsx --test tests/frontend.test.ts` printed `tests 3`, `pass 3`, `fail 0`; `node --check public/app.js` exited 0.
VERIFIED browser: published exp-001; baseline `slip`; Arm C `incompatible / gripper mismatch`; Arm B `compatible`; saved payment `confirmed`; recovery `success`.
No new payment was required for this UI check.
VERIFIED viewport checks at requested widths 375, 768 and 1280 returned equal client/scroll widths: 360/360, 753/753 and 1265/1265. Scrollbars account for the 15px difference.
This checks page overflow, not every device or assistive technology.
Payment code, wallet keys, mvp.md and vision.md were not changed by this redesign.
Next action: open `http://127.0.0.1:3333` and try the redesigned workspace.

## Active checkpoint pass, 2026-10-13

Owner coordinator. Status In Progress.
Correction: Git remote is now attached on checkpoint/devnet-batches. Earlier Git blocker is historical.
REPORTED prior combined verification: tests 56, pass 56, fail 0. Recheck changed behavior after this parallel pass.
REPORTED simulator batch report: total 12, passed 12, failed 0, paymentTransactions 0.
REPORTED public payment batches: 12 Agung and 12 Solana requests remain blocked by zero test-wallet balances.
In Progress: UI-6 public recovery visibility, OS-7 peaqOS audit, REL-8 release audit, INT-9 evidence and hosting.

## Setup checkpoint, 2026-10-13

Owner coordinator. Setup: Completed. Public settlement: Blocked.
VERIFIED: `npm test` printed `tests 63`, `pass 63`, `fail 0` with localhost socket access.
Correction: sandbox-only run printed 62 passes and one `listen EPERM` failure in the mock RPC test. The socket-enabled run resolved that environment failure.
VERIFIED: typecheck, build, public build and frontend syntax exited 0.
VERIFIED local payment demo: `payment: confirmed`, `sellerReceived: 0.001 local ETH`, `baseline: slip`, `recovery: success`, `retry: same signed transaction, seller paid once`.
Hash: `0x0e5b0444acd83c261ba4d63f7b52c7eaade058c19213981034b0d5fa22d1c71a`, chain 31337 only.
VERIFIED Cloudflare MCP upload HTTP 200: worker exbridge-app, deployment b74c47a9001043e095e3e55655edee85.
VERIFIED domain binding HTTP 200: exbridge.world, domain ID 6748239ff14ed73e57ea01d1160c0e373d0eace9. Existing pitch.exbridge.world was untouched.
VERIFIED live browser at https://exbridge.world: sample loaded, baseline slip at 12 N, Arm B compatible, recovery success at 8 N, Arm C gripper mismatch.
VERIFIED peaqOS panel shows recorded 0.4 AGUNG bond and activation blocked. This does not establish live activation.
VERIFIED desktop client/scroll width 1265/1265. This checks overflow at one width only.
Screenshot: /private/tmp/exbridge-public-preview.jpg.
REPORTED focused agent proofs: frontend reset mutation collected one failure; readiness loading mutation collected two failures; peaqOS subscription mutation collected one failure. Agents restored each mutation.
REPORTED batch report checks: atomic replacement preserves prior JSON on rename failure; malformed existing report prevents run-ID reuse.
User decision: continue setup and leave live runs blocked. No public payment or activation was attempted in this pass.
PR and merge checkpoint: Blocked. Public settlement is not all-good. No commits or PRs were created in this pass.
Next action: open https://exbridge.world and run the synthetic preview. See evidence.md for transaction index and remaining chain requirements.
VERIFIED follow-up: HTTPS /health returned status ok, mode public-demo, paymentSigning false. Public simulation report returned HTTP 200.
VERIFIED mobile viewport request 375x812: clientWidth 360, scrollWidth 360. Viewport override reset afterward.
VERIFIED prose detector: evidence.md, docs/interfaces.md, docs/decisions.md and status.md returned no issues. README's two flagged dash sequences are required npm argument separators in code blocks, not prose punctuation.
VERIFIED `git diff --check` exited 0.

## Design release, 2026-10-14

Owner: release. Public design deployment: Completed. peaqOS activation: Blocked.
VERIFIED: `npm run check` exited 0. Socket-enabled `npm test` printed `tests 63`, `pass 63`, `fail 0`.
VERIFIED: `npm run build`, `npm run demo`, `npm run build:public`, `node --check public/app.js` and `git diff --check` exited 0.
VERIFIED: Cloudflare upload returned HTTP 200 for `exbridge-app`, deployment `e9d92ab34ef84d57bfd63a69e327f208`.
VERIFIED: HTTPS `/`, `/styles.css` and `/app.js` returned HTTP 200 and matched the local files byte for byte.
VERIFIED: live `/health` returned `status: ok`, `mode: public-demo`, `paymentSigning: false`.
VERIFIED: live synthetic baseline returned `outcome: slip`; recovery returned `outcome: success`, `paymentSent: false`; incompatible recovery returned HTTP 422, `gripper mismatch`.
VERIFIED: Agung `eth_getBalance` for `0xb1B6938BAcEAAe2007Ce26D8ad248d54F25c0fB1` returned HTTP 200 and `result: 0x0`.
The balance check does not verify current registration or refresh the recorded activation preview. No activation or payment was submitted.
VERIFIED source: `scripts/peaqos-check.ts` requires the preview net bond plus `50000000000000000` wei as a gas reserve. The recorded 0.4 AGUNG bond therefore requires at least 0.45 AGUNG under this guard.
Next action: open https://exbridge.world and try the published simulator. Real activation requires test funds and a separately authorized transaction.
VERIFIED: release commit `1ab660e` was pushed to `origin/codex/design-release`. Git reported `[new branch] codex/design-release -> codex/design-release`.
VERIFIED: PR creation through the GitHub connector returned HTTP 403, `Resource not accessible by integration`.
VERIFIED: the automatic approval review rejected CLI PR creation because it requires explicit user approval for that external publication. No PR was created. Remote CI status is not determined.
Follow-up: obtain approval to open the PR. Do not merge without separate authorization and passing CI.
