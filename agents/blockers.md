# Blockers

2026-10-13. Owner: coordinator.

Core MVP: none.
Remote CI and PR: Blocked. VERIFIED initial command: `fatal: not a git repository`. No remote is configured in this folder.
Real peaq settlement: Planned, outside the completed synthetic MVP. Network configuration, test funds and explicit transaction approval are required.

## Payment update, 2026-10-13

Correction: Agung integration is now implemented; the earlier planned-status entry is obsolete.
VERIFIED: local payment example exited 0 with `payment: confirmed` and `sellerReceived: 0.001 local ETH`.
Public testnet confirmation is blocked by funding. Faucet-reported hash has no RPC receipt; buyer balance is `0x0`.
Exact evidence is in `status.md`. No private credential is needed from the user.

ID: BLK-2026-10-13-CHAIN
Date: 2026-10-13
Owner: coordinator
Severity: High
Description: Both dedicated public test wallets had zero balance at the recorded preflight. peaqOS activation and public settlement remain unverified.
Proposed resolution: Keep setup usable. Resume with funded test wallets only when the user requests live runs.
Status: Blocked
Evidence: data/evidence/checkpoint-20261013-agung.json, data/evidence/checkpoint-20261013-solana-devnet.json, data/evidence/peaqos-readiness.json. User chose to leave live runs blocked.
