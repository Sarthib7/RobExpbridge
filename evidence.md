# Evidence index

2026-10-13. Owner: coordinator. Public settlement checkpoint: Blocked.

VERIFIED reports below contain 12 passed constructed checks and zero confirmed public payment transactions. The user requested setup to continue while live runs remain blocked. These checks do not establish physical robot performance or safety.

## Constructed checks

VERIFIED report: [simulation-batches.json](data/evidence/simulation-batches.json). Report output: `total: 12`, `passed: 12`, `failed: 0`, `paymentTransactions: 0`.

| Check | Actual verdict | Passed |
| --- | --- | --- |
| baseline-and-approved-recovery | compatible | True |
| incompatible-gripper | incompatible | True |
| fixture-mismatch | incompatible | True |
| missing-context | requires_review | True |
| tampered-digest | rejected | True |
| expired-record | rejected | True |
| revoked-record | rejected | True |
| low-evidence | rejected | True |
| force-envelope | incompatible | True |
| wrong-task | incompatible | True |
| missing-record-rights | rejected | True |
| repeat-identical-fixture | compatible | True |

## Public payment batch index

VERIFIED report contents: each payment below stopped at the balance preflight. No transaction was prepared. Blocked rows are not completed payment runs.

| Network | Test run | State | Transaction |
| --- | --- | --- | --- |
| agung | checkpoint-20261013-1 | blocked | None |
| agung | checkpoint-20261013-2 | blocked | None |
| agung | checkpoint-20261013-3 | blocked | None |
| agung | checkpoint-20261013-4 | blocked | None |
| agung | checkpoint-20261013-5 | blocked | None |
| agung | checkpoint-20261013-6 | blocked | None |
| agung | checkpoint-20261013-7 | blocked | None |
| agung | checkpoint-20261013-8 | blocked | None |
| agung | checkpoint-20261013-9 | blocked | None |
| agung | checkpoint-20261013-10 | blocked | None |
| agung | checkpoint-20261013-11 | blocked | None |
| agung | checkpoint-20261013-12 | blocked | None |
| solana-devnet | checkpoint-20261013-1 | blocked | None |
| solana-devnet | checkpoint-20261013-2 | blocked | None |
| solana-devnet | checkpoint-20261013-3 | blocked | None |
| solana-devnet | checkpoint-20261013-4 | blocked | None |
| solana-devnet | checkpoint-20261013-5 | blocked | None |
| solana-devnet | checkpoint-20261013-6 | blocked | None |
| solana-devnet | checkpoint-20261013-7 | blocked | None |
| solana-devnet | checkpoint-20261013-8 | blocked | None |
| solana-devnet | checkpoint-20261013-9 | blocked | None |
| solana-devnet | checkpoint-20261013-10 | blocked | None |
| solana-devnet | checkpoint-20261013-11 | blocked | None |
| solana-devnet | checkpoint-20261013-12 | blocked | None |

Reports: [Agung](data/evidence/checkpoint-20261013-agung.json), [Solana devnet](data/evidence/checkpoint-20261013-solana-devnet.json).

## peaqOS

VERIFIED [SDK readiness report](data/evidence/peaqos-readiness.json): deployment `agung-2026-08-28`, chain `9990`, `balanceWei: 0`, `bondAmount: 400000000000000000`, `activationStateError: MACHINE_NOT_FOUND`, `transactionHash: null`. The machine ID in that report is computed, not registered. No activity event is claimed.

INFERRED setup budget: 0.582 AGUNG covers the reported 0.4 bond, the configured 0.05 activation reserve and 0.132 batch reserve. Actual fees may differ. Solana batch reserve is 0.0132 SOL.

Dedicated test addresses:

- Agung: `0xb1B6938BAcEAAe2007Ce26D8ad248d54F25c0fB1`.
- Solana devnet: `EgPwYPZK6D7JZyHCLMxf1dxsGykmqswDGsz7MeaDpVCG`.

REPORTED official [Solana onboarding guide](https://docs.peaq.xyz/peaqos/guides/onboard-on-solana): peaqOS onboarding is mainnet-only. Solana devnet payments in this project are separate from peaqOS onboarding. The [peaqOS AI guide](https://docs.peaq.xyz/peaqos/peaqos-ai) is an integration reference, not evidence of this machine being active.

## Current local payment verification

VERIFIED `npm run demo:payments` exited 0 on 2026-10-13: `payment: confirmed`, `sellerReceived: 0.001 local ETH`, `baseline: slip`, `recovery: success`, `retry: same signed transaction, seller paid once`.
Local chain 31337 hash: `0x0e5b0444acd83c261ba4d63f7b52c7eaade058c19213981034b0d5fa22d1c71a`.
This disposable local transaction is not public settlement.

VERIFIED integrated suite: `tests 63`, `pass 63`, `fail 0`.
The first sandboxed run failed because its mock RPC could not open a localhost socket (`listen EPERM`). The socket-enabled run passed.

## Earlier local transactions

REPORTED historical session records. These are local Anvil transactions on chain 31337, not public testnet settlement. Disposable chains may no longer be queryable.

| Test | Local transaction hash |
| --- | --- |
| Earlier disposable example | `0x00203f4c52a91cb5b0499d5d55a0d0ccf38f7c86671a09ee0fa14c12088b0d65` |
| Payment example | `0x0733779b14b48681638e03970eb6e41692d23d442835ef5c1357cf8c0da3964e` |
| Persistent browser example | `0x5636d12963828069b8c1fbeeca14950c53dae218240b7380b8ca7b3bad379ccc` |

REPORTED faucet claim: `0xeec5c3ccb5cdb01f51d537d0cb78d45e79ca35a50da7bb5686e37b917e3fb689`. Earlier RPC queries returned null transaction and receipt. This is not a verified transaction.

## Demo flow

1. Load the synthetic sample and run the baseline. Inspect the slip at 12 N.
2. Check Arm B compatibility and run the public preview recovery at 8 N. The preview sends no payment.
3. Select Arm C. Inspect the gripper rejection.
4. Open this evidence index. Use the local payment demo for settlement mechanics. Public testnet receipts remain blocked.

## Remaining checkpoint

Public payments, peaqOS activation and exact PR-head remote CI still need verification. No claim of full bounty completion, hardware validation or TEE privacy is made.
