import type { ExperienceInput } from "./domain/schema.js";
import { withDigest } from "./memory/integrity.js";

/** Arm A recovery experience — synthetic demo data only. */
export function armAExperienceInput(overrides: Partial<ExperienceInput> = {}): ExperienceInput {
  return {
    schemaVersion: "0.1",
    id: "exp-001",
    contributor: { organization: "factory-a", machineId: "arm-a" },
    task: "connector_insertion",
    context: {
      robotModel: "arm-x",
      gripper: "parallel-v1",
      material: "polymer-demo",
      fixture: "fixture-7",
      forceLimitN: 12,
    },
    failure: { procedure: "baseline_insert", outcome: "slip" },
    advisory: { procedure: "reduced_force_insert", forceN: 8 },
    evidence: {
      level: "simulation-tested",
      testId: "fixture-test-1",
      attempts: 1,
      successes: 1,
    },
    rights: { license: "demo-only", redistribution: false },
    revoked: false,
    createdAt: "2026-10-12T12:00:00.000Z",
    ...overrides,
  };
}

export function armAExperience() {
  return withDigest(armAExperienceInput());
}

export function armBQuery() {
  return {
    task: "connector_insertion",
    context: {
      robotModel: "arm-x",
      gripper: "parallel-v1",
      material: "polymer-demo",
      fixture: "fixture-7",
      forceLimitN: 12,
    },
    acceptedLicenses: ["demo-only"],
    minEvidence: "simulation-tested" as const,
  };
}

export function armCQuery() {
  return {
    task: "connector_insertion",
    context: {
      robotModel: "arm-x",
      gripper: "vacuum-v2",
      material: "polymer-demo",
      fixture: "fixture-7",
      forceLimitN: 12,
    },
    acceptedLicenses: ["demo-only"],
    minEvidence: "simulation-tested" as const,
  };
}
