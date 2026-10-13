# AGENTS.md — ExperienceBridge Contributor and Coding-Agent Instructions

Read `mvp.md` first for acceptance criteria and `vision.md` for scope, competitive context and security boundaries. **The near-term assignment is the v0.1 simulator, not the full long-term platform.**

## Mission
Implement a reproducible, minimal experience-sharing proof of concept: Arm A contributes a simulator-tested recovery; compatible Arm B consults it before acting and avoids the known simulated failure; incompatible Arm C is rejected. Preserve evidence labels, safety constraints and truthful integration status.

## Non-negotiable rules
1. **Do not build a new OS, SLAM, controller, training model, marketplace or compute network.** Integrate existing software.
2. **Do not issue physical robot commands.** Advice is not executable authority. No safety-critical integration.
3. **Never imply a simulated result establishes real-world performance or safety.**
4. **Never claim hardware-backed TEE privacy from dstack local simulator/no-TEE mode.** Verify quotes and trust roots before any hardware privacy claim.
5. **Never fabricate a peaq transaction, machine ID, explorer link, price, benchmark, signature or attestation.** Label mocks explicitly.
6. **No real factory telemetry, private keys, wallet mnemonics, API secrets or personal data in fixtures, logs or commits.**
7. **Fail closed** on incompatible hardware, missing critical context, expired experience or insufficient evidence.
8. **Do not auto-install or execute downloaded robot procedures.** Return typed advisories to existing authorized controllers.
9. Respect third-party licenses and dataset usage rights; never assume public access means redistribution rights.
10. Keep dependencies and architecture minimal. Prefer deterministic tests over visual polish.

## Suggested implementation
Node.js 20+, TypeScript, Fastify, Zod, built-in crypto; local JSON store initially. Use interfaces so peaq, dstack and ROS 2 integrations can be added without refactoring core matching logic.

```text
src/domain/schema.ts
src/memory/store.ts
src/memory/match.ts
src/memory/integrity.ts
src/sim/assembly.ts
src/economics/peaq.ts
src/server.ts
scripts/demo.ts
tests/*.test.ts
```

## Workflow for agents
1. Read docs and inspect repo; do not overwrite user work.
2. Write the deterministic simulator and tests for baseline vs approved alternative.
3. Define strict typed schema; store experiences with provenance and computed integrity digests.
4. Implement compatibility gates and human-readable rejection reasons.
5. Add HTTP endpoints and a one-command CLI demo.
6. Run tests; fix errors; record actual measured outputs.
7. Only then attempt real peaq testnet integration, using current official SDK/network documentation and test-only credentials.
8. Optionally add dstack development-mode adapter, clearly marked non-confidential; do not block core MVP on cloud deployment.
9. Update README with install/run/test/demo commands, what is real versus mocked, and known limitations.
10. Summarize implemented functionality, test results, unresolved risks and exact next steps.

## Definition of done
- `npm install`, `npm test` and `npm run demo` work from a clean checkout (adapt scripts if different).
- Arm B without memory fails and with compatible memory succeeds under identical **constructed** conditions.
- Arm C's mismatched gripper is rejected, not silently downgraded.
- Tampered record is detected; expired/low-evidence records cannot be auto-recommended.
- The demo shows provenance, compatibility explanation, evidence label and measured outcome.
- peaq status is accurate: real transaction with verified hash or explicit simulation.
- No claim of TEE confidentiality unless actual hardware attestation has been verified.

## Test cases
- Matching task/hardware/context → compatible.
- Different gripper or fixture → incompatible.
- Missing required context → requires_review.
- Experience below minimum evidence → rejected.
- Expired/revoked record → rejected.
- Altered record bytes → digest verification failure.
- Baseline and memory scenario use same seed/fixture and deterministic rules.
- Payment adapter errors never produce a fake success receipt.

## Code and security quality
- Validate all API inputs; return typed errors; avoid dumping task payloads to logs.
- Canonicalize content for hashes; exclude digest field itself; do not mistake hashing for provenance authentication.
- Keep money/chain actions isolated in `economics/peaq.ts`; avoid irreversible operations without explicit configuration.
- Store only synthetic data by default; use `.env.example`, not committed `.env`.
- Add idempotency keys to any later paid execution workflow.
- Do not conflate text similarity, simulation success, field validation and safety approval.

## Integration guidance
- **peaq:** `https://github.com/peaqnetwork/peaq-sdk-js`; confirm current SDK and network configuration before implementing. Reuse peaqOS machine identities and existing settlement capabilities.
- **dstack:** `https://github.com/Dstack-TEE/dstack/blob/next/sdk/js/README.md`; current v1 uses `getKey(domain, algorithm)` and `attest(reportData)`; local simulator is for development only.
- **Robotics:** ROS 2, MCAP, Open-RMF and vendor controllers remain external; add adapters after core tests.

## When uncertain
Prefer a clearly labeled stub and a failing/skip test with explanation over inventing provider behavior. Document any assumption. Ask for credentials, dataset permissions or network parameters only when essential to the next real integration step.
