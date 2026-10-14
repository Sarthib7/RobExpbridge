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
