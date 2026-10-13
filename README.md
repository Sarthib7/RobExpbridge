# ExperienceBridge v0.1

Minimal, deterministic proof that a simulator-tested recovery experience can be published by one arm, retrieved by a compatible arm **before acting**, and refused for incompatible hardware.

This is **not** a robotics OS, controller, marketplace, TEE product, or real-world safety claim.

## What this demo proves

| Arm | Hardware | Without memory | With memory |
|---|---|---|---|
| A (contributor) | `arm-x` + `parallel-v1` | baseline slip | reduced-force success → publishes experience |
| B (compatible) | same relevant context | baseline slip | query → advisory → success (**constructed**) |
| C (incompatible) | `vacuum-v2` gripper | — | **rejected** (`gripper mismatch`) |

All simulation outcomes are **constructed and deterministic**. They do not establish real-world performance or safety.

## Quick start

```bash
npm install
npm test
npm run demo
npm start   # HTTP API on PORT (default 8787)
```

Requires Node.js 20+.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health + peaq mode |
| `POST` | `/experiences` | Validate, digest, publish |
| `GET` | `/experiences/:id` | Provenance, rights, evidence |
| `POST` | `/experiences/query` | Pre-execution match with reasons |
| `POST` | `/simulation/run` | Deterministic assembly scenario |
| `POST` | `/economics/license-payment` | peaq license receipt (simulated by default) |

### Example query (Arm B)

```bash
curl -s localhost:8787/experiences/query -H 'content-type: application/json' -d '{
  "task": "connector_insertion",
  "context": {
    "robotModel": "arm-x",
    "gripper": "parallel-v1",
    "material": "polymer-demo",
    "fixture": "fixture-7",
    "forceLimitN": 12
  }
}'
```

## Compatibility policy (fail closed)

Hard gates: task, robot model, gripper, material, fixture, force envelope, license, minimum evidence.

- Missing critical context → `requires_review`
- Hardware/context mismatch → `incompatible` (never silently downgraded)
- Expired, revoked, low evidence, bad digest → `rejected`

Evidence labels are never upgraded: `observed` < `simulation-tested` < `operator-approved` < `field-validated`.

Output is **advisory only**. No physical robot commands are issued.

## Integrity

Records are canonicalized (sorted keys) and hashed with SHA-256, excluding the `integrity` field. A matching digest proves integrity relative to a trusted hash — **not** that physical observations were true.

## peaq status (truthful)

| Mode | How | Receipt |
|---|---|---|
| **simulated** (default) | `PEAQ_MODE=simulated` or `PEAQ_ENABLED` unset | Explicit `status: "simulated"`, `transactionHash: null` |
| **live attempt** | `PEAQ_MODE=live` + `PEAQ_ENABLED=true` + RPC/seed | v0.1 returns `status: "error"` until SDK/network params are verified — **never a fake success hash** |

See `.env.example`. Do not commit secrets.

Official SDK to verify before live use: [peaq-sdk-js](https://github.com/peaqnetwork/peaq-sdk-js).

## dstack / TEE

Not integrated in v0.1. Local simulator / no-TEE mode must **not** be described as hardware-backed confidential compute.

## Project layout

```text
src/domain/schema.ts      # Zod schemas
src/memory/integrity.ts   # Canonical hash + verify
src/memory/store.ts       # Local JSON store
src/memory/match.ts       # Compatibility gates
src/sim/assembly.ts       # Deterministic simulator
src/economics/peaq.ts     # Isolated payment adapter
src/server.ts             # Fastify HTTP API
scripts/demo.ts           # One-command CLI demo
tests/*.test.ts
```

## What is real vs mocked

| Component | Status |
|---|---|
| Deterministic assembly simulator | Real (constructed rules) |
| Schema validation, store, match, digests | Real |
| HTTP API + CLI demo | Real |
| peaq settlement | **Simulated** by default; live path refuses fake success |
| dstack attestation | Not present |
| ROS 2 / physical robots | Not present |
| Factory telemetry | Synthetic fixtures only |

## Known limitations

- Single constructed connector-insertion scenario (`fixture-test-1`).
- No statistical transfer learning claim; before/after is 0/1 → 1/1 by design.
- No human review UI beyond typed `requires_review` status.
- No ROS/MCAP ingestion, revocation service network, or confidential matching.
- peaq live submission intentionally unimplemented until current network/SDK config is confirmed.

## License / rights

Demo experiences use `license: "demo-only"` with `redistribution: false`. Do not treat fixtures as redistributable factory data.
