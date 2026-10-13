# ExperienceBridge — MVP Specification

**v0.1 · 12 October 2026 · Target: two-hour proof of concept**

## Objective
Demonstrate that one simulated industrial arm can contribute an evidence-labeled recovery experience, a compatible arm can retrieve it **before executing** and avoid a repeat failure, and an incompatible arm is refused. This tests a narrow mechanism, not real-world safety or product-market fit.

## Scenario
- **Arm A, Factory A:** `arm-x`, `parallel-v1` gripper, connector insertion. Baseline force causes a simulated slip; a lower-force procedure succeeds in a controlled simulator. An experience is published.
- **Arm B, Factory B:** Same relevant robot, gripper, connector, fixture, material and force envelope. Without memory: known failure. With memory: receives advisory and succeeds in the *same deterministic scenario*.
- **Arm C, Factory B:** `vacuum-v2` gripper. Must reject the lesson as incompatible.
- No real machines, real-world claims, or proprietary footage in v0.1.

## Deliverables
1. TypeScript deterministic simulator; no randomized outcomes engineered to imply a gain.
2. Experience JSON schema, validation and local JSON/SQLite store.
3. Publish and pre-execution query endpoints, returning compatibility reasons and evidence level.
4. Evidence digest verification and tamper-negative test.
5. Before/after comparison and incompatible-robot rejection, reproducible from CLI or minimal web UI.
6. peaq testnet economic interaction **if** credentials, current network configuration and funds are available; otherwise a conspicuously simulated receipt, not a fabricated chain transaction.
7. README, commands, tests, demo and truthful limitations.

## Experience schema (proposed, not an existing standard)
```json
{
  "schemaVersion": "0.1",
  "id": "exp-001",
  "contributor": {"organization": "factory-a", "machineId": "arm-a"},
  "task": "connector_insertion",
  "context": {"robotModel": "arm-x", "gripper": "parallel-v1", "material": "polymer-demo", "fixture": "fixture-7", "forceLimitN": 12},
  "failure": {"procedure": "baseline_insert", "outcome": "slip"},
  "advisory": {"procedure": "reduced_force_insert", "forceN": 8},
  "evidence": {"level": "simulation-tested", "testId": "fixture-test-1", "attempts": 1, "successes": 1},
  "rights": {"license": "demo-only", "redistribution": false},
  "integrity": {"sha256": "COMPUTED_AT_RUNTIME"}
}
```
Canonicalize and hash record contents excluding the digest field. A hash proves integrity relative to a trusted digest, **not** the truth of physical observations.

## API
```text
POST /experiences             Validate and publish
POST /experiences/query       Query task + hardware + environment; explain match/rejection
GET  /experiences/:id         Retrieve provenance, rights and evidence
POST /simulation/run          Run fixed scenario, with or without approved advisory
GET  /health                  Health
```

## Compatibility policy
- Hard gates: task, robot model, end effector, connector/fixture/material, safe parameter envelope, permitted license, minimum evidence level.
- Missing critical fields = `requires_review`; mismatch = `incompatible`. Never substitute text similarity for a safety constraint.
- Evidence labels: `observed`, `simulation-tested`, `operator-approved`, `field-validated`. Do not silently upgrade levels.
- All output is **advisory**. Existing robot controller/planner remains responsible for execution and safety.

## Tests / acceptance criteria
- Identical baseline scenario: Arm B fails without memory, succeeds with applicable advisory.
- Arm C receives no applicable recommendation, with explicit `gripper mismatch` reason.
- Altered record fails integrity check.
- Expired/unverified experience is not automatically recommended.
- Record measured local query time, repeated failures avoided, and rejection rate. The 0/1 vs 1/1 result is a constructed demo outcome, **not** a statistical effectiveness claim.
- Show a real peaq explorer transaction hash only if actually submitted and verified.

## Two-hour implementation plan
| Time | Task | Done when |
|---|---|---|
| 0–20 min | Scaffold TS project, simulator, fixtures | Repeatable baseline and alternate outcomes |
| 20–45 min | Schema, store, retrieval | Arm B matches; Arm C rejected |
| 45–65 min | Integrity, evidence gates, unit tests | Tamper and negative tests pass |
| 65–90 min | CLI/demo UI, metrics | One-command before/after run |
| 90–110 min | peaq testnet integration attempt | Actual transaction, or honestly labeled mock |
| 110–120 min | README, demo, limitations | Reproducible clean setup |

## Suggested stack and tree
Node 20+, TypeScript, Fastify, Zod, Node crypto, JSON initially. No LLM, vector DB, blockchain smart contract, or ROS driver is required for core demonstration.
```text
src/server.ts
src/domain/schema.ts
src/memory/{store,match,integrity}.ts
src/sim/assembly.ts
src/economics/peaq.ts
scripts/demo.ts
tests/{match,sim,integrity}.test.ts
data/fixtures/experiences.json
.env.example
README.md
mvp.md
vision.md
agents.md
```

## peaq / dstack boundaries
peaq: reuse machine identity, attribution and existing payment mechanisms; verify live SDK, RPC, chain ID and explorer from official docs before integration. A payment within one factory is artificial; simulate cross-company licensed insight access. dstack: future confidential matching; simulator/no-TEE mode does **not** provide hardware privacy. Current dstack JS SDK supports `getKey(domain, algorithm)` and `attest(reportData)` on its v1 agent. Never claim production attestation without verified hardware evidence.

## Demo script
Arm A fails → records simulator-tested recovery → Arm B baseline fails → Arm B queries → compatible advisory returned → same scenario succeeds → Arm C query rejected → tampering rejected → show real or explicitly simulated peaq license payment.

## Go/no-go
Proceed to a pilot only if relevant lessons improve a less contrived benchmark, permissions allow sharing, real operators confirm a costly repeat-failure problem, and existing fleet platforms do not already solve the target workflow. See `vision.md` for competitive and commercial risks.
