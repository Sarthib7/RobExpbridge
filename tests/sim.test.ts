import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { baselineScenario, memoryScenario, runAssemblySimulation } from "../src/sim/assembly.js";

describe("assembly simulator", () => {
  it("baseline fails under identical constructed conditions", () => {
    const a = baselineScenario();
    const b = baselineScenario();
    assert.equal(a.outcome, "slip");
    assert.equal(b.outcome, "slip");
    assert.equal(a.seed, b.seed);
    assert.equal(a.fixture, b.fixture);
    assert.equal(a.constructed, true);
  });

  it("approved reduced_force advisory succeeds under same seed/fixture", () => {
    const baseline = baselineScenario();
    const withMemory = memoryScenario();
    assert.equal(baseline.outcome, "slip");
    assert.equal(withMemory.outcome, "success");
    assert.equal(baseline.seed, withMemory.seed);
    assert.equal(baseline.fixture, withMemory.fixture);
  });

  it("vacuum gripper is rejected, not remapped", () => {
    const result = runAssemblySimulation({
      seed: "fixture-test-1",
      fixture: "fixture-7",
      robotModel: "arm-x",
      gripper: "vacuum-v2",
      material: "polymer-demo",
      procedure: "reduced_force_insert",
      forceN: 8,
      forceLimitN: 12,
    });
    assert.equal(result.outcome, "rejected");
    assert.match(result.reason, /gripper/i);
  });

  it("is deterministic across repeated calls", () => {
    const runs = Array.from({ length: 5 }, () => memoryScenario());
    assert.ok(runs.every((r) => r.outcome === "success"));
  });
});
