# Solana devnet demo with the local CLI wallet

VERIFIED on 2026-10-14: the app completed one approved 0.001 SOL devnet payment using the existing Solana CLI wallet. The key file was read in place, not copied into the project.

## Run

From this checkout, run:

```sh
SOLANA_SELLER_ADDRESS=5Br4L66bZhvpErnaih7prwXwjk3VViz5SJ7Wa8Vk4cDF node --import tsx scripts/solana-cli-demo.ts
```

Open http://127.0.0.1:3336. The buyer defaults to the key at `~/.config/solana/id.json`. Use `SOLANA_KEYPAIR_PATH` to select another local key file. `EB_DATA_DIR`, `PORT` and `SOLANA_RPC_URL` are optional. The gateway requires the Solana devnet genesis before payment operations.

VERIFIED source: `scripts/solana-cli-demo.ts` requires mode 0600, validates the 64-byte keypair and checks that the public key matches its seed. Existing order storage and payment guards remain in use. Starting the app does not submit a transaction. Payment actions can spend the selected wallet's devnet SOL.

## Recorded result

VERIFIED public RPC: confirmation `finalized`, slot `511057765`, transfer `1000000` lamports, fee `5000` lamports.
VERIFIED app output: baseline `slip`, Arm B `compatible`, Arm C `incompatible` with `gripper mismatch`, paid recovery `success` at 8 N.
VERIFIED memo: order `54a769d4-755f-4ac7-a1dc-34b15f86f00a` and digest `cd2a85024abefd06981c8f182f101cbff5c23dbfb922238e15c6d4c17b86bf00` match the finalized transaction.

[Explorer receipt](https://explorer.solana.com/tx/3Bd94scCn2mFDeMPjAV9r7Kue6WC13dYXZkQHNGmFH2N5pp3AmRdPGAnouFN2dw2AtfEHMVMouLXeztQbYV263WN?cluster=devnet).
[Public evidence JSON](../data/evidence/solana-devnet-live-20261014.json).

The receipt verifies a devnet transfer. The robot outcomes are constructed simulator results. This run does not establish Agung settlement, peaqOS registration or hardware safety. RPC verification trusts the configured node.

## Checks

VERIFIED: type checking exited 0; CLI-wallet tests printed `tests 3`, `pass 3`, `fail 0`.
VERIFIED regression proof: removing the public-key match check produced `tests 1`, `pass 0`, `fail 1`; restoring it produced three passing tests.
Existing CI discovers the new tests through `tests/*.test.ts` and runs them without accessing the user's wallet.
