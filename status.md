# Release slices

2026-10-14. Owner: release. Status: In Progress.

REPORTED user request: split the preserved checkpoint into small PRs and merge each after passing CI.
VERIFIED baseline: `b0fcd55`. Preserved checkpoint: `b654d92`.
Planned order: core recovery, EVM orders, Solana gateway, public interface, peaqOS checks, release material.
Current scope: simulator, schema, store, API, deterministic tests and CI.
Next action: verify core behavior and open its PR.
VERIFIED core checks: `npm run check` exited 0; `npm test` printed `tests 15`, `pass 15`, `fail 0`; `npm run demo` exited 0.
VERIFIED regression proof: widening baseline success to 12 N made the focused behavior test print `tests 1`, `pass 0`, `fail 1` and exit 1. Source restored afterward.
