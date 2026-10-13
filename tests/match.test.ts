import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { armAExperience, armAExperienceInput, armBQuery, armCQuery } from "../src/fixtures.js";
import { evaluateMatch, queryExperiences } from "../src/memory/match.js";
import { withDigest } from "../src/memory/integrity.js";
import type { Experience } from "../src/domain/schema.js";

const NOW = new Date("2026-10-13T00:00:00.000Z");

describe("compatibility matching", () => {
  it("matching task/hardware/context → compatible", () => {
    const result = evaluateMatch(armAExperience(), armBQuery(), NOW);
    assert.equal(result.status, "compatible");
    assert.equal(result.advisory?.procedure, "reduced_force_insert");
    assert.equal(result.evidenceLevel, "simulation-tested");
    assert.equal(result.advisoryOnly, true);
  });

  it("different gripper → incompatible with explicit reason", () => {
    const result = evaluateMatch(armAExperience(), armCQuery(), NOW);
    assert.equal(result.status, "incompatible");
    assert.ok(result.reasons.some((r) => r.includes("gripper mismatch")));
    assert.equal(result.advisory, undefined);
  });

  it("different fixture → incompatible", () => {
    const query = {
      ...armBQuery(),
      context: { ...armBQuery().context, fixture: "fixture-9" },
    };
    const result = evaluateMatch(armAExperience(), query, NOW);
    assert.equal(result.status, "incompatible");
    assert.ok(result.reasons.some((r) => r.includes("fixture mismatch")));
  });

  it("missing required context → requires_review", () => {
    const query = {
      task: "connector_insertion",
      context: { robotModel: "arm-x", gripper: "parallel-v1" },
      acceptedLicenses: ["demo-only"],
      minEvidence: "simulation-tested" as const,
    };
    const result = evaluateMatch(armAExperience(), query, NOW);
    assert.equal(result.status, "requires_review");
    assert.ok(result.reasons.some((r) => r.includes("missing required context")));
  });

  it("experience below minimum evidence → rejected", () => {
    const low = withDigest(
      armAExperienceInput({
        id: "exp-low",
        evidence: {
          level: "observed",
          testId: "fixture-test-1",
          attempts: 1,
          successes: 0,
        },
      }),
    );
    const result = evaluateMatch(low, armBQuery(), NOW);
    assert.equal(result.status, "rejected");
    assert.ok(result.reasons.some((r) => r.includes("evidence below minimum")));
  });

  it("expired record → rejected", () => {
    const expired = withDigest(
      armAExperienceInput({
        id: "exp-expired",
        expiresAt: "2026-10-01T00:00:00.000Z",
      }),
    );
    const result = evaluateMatch(expired, armBQuery(), NOW);
    assert.equal(result.status, "rejected");
    assert.ok(result.reasons.some((r) => r.includes("expired")));
  });

  it("revoked record → rejected", () => {
    const revoked = withDigest(armAExperienceInput({ id: "exp-revoked", revoked: true }));
    const result = evaluateMatch(revoked, armBQuery(), NOW);
    assert.equal(result.status, "rejected");
    assert.ok(result.reasons.some((r) => r.includes("revoked")));
  });

  it("tampered experience is rejected by query path", () => {
    const good = armAExperience();
    const tampered = {
      ...good,
      advisory: { ...good.advisory, forceN: 1 },
    } as Experience;
    const outcome = queryExperiences([tampered], armBQuery(), NOW);
    assert.equal(outcome.result.status, "rejected");
    assert.ok(outcome.result.reasons.some((r) => r.includes("digest")));
  });
});
