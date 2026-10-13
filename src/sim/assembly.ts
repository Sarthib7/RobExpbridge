import {
  SimulationRequestSchema,
  type SimulationRequest,
  type SimulationResult,
} from "../domain/schema.js";

const DISCLAIMER =
  "Constructed deterministic simulator outcome. Does not establish real-world performance or safety.";

/**
 * Deterministic connector-insertion simulator.
 *
 * Rules (fixed; no randomness engineered to imply a gain):
 * - Same seed + fixture + hardware → same outcome for a given procedure/force.
 * - baseline_insert at forceN >= 10 (typical factory baseline 12N) → slip
 *   on polymer-demo / fixture-7 / parallel-v1 / arm-x.
 * - reduced_force_insert at forceN <= 8 and within forceLimitN → success
 *   under the same constructed conditions.
 * - Wrong gripper / unsupported combo → rejected (not silently remapped).
 */
export function runAssemblySimulation(raw: SimulationRequest): SimulationResult {
  const req = SimulationRequestSchema.parse(raw);

  if (req.robotModel !== "arm-x") {
    return result(req, "rejected", `unsupported robotModel: ${req.robotModel}`);
  }
  if (req.fixture !== "fixture-7") {
    return result(req, "rejected", `unsupported fixture: ${req.fixture}`);
  }
  if (req.material !== "polymer-demo") {
    return result(req, "rejected", `unsupported material: ${req.material}`);
  }
  if (req.gripper !== "parallel-v1") {
    return result(
      req,
      "rejected",
      `gripper not supported in this constructed scenario: ${req.gripper}`,
    );
  }
  if (req.forceN > req.forceLimitN) {
    return result(
      req,
      "rejected",
      `forceN ${req.forceN} exceeds forceLimitN ${req.forceLimitN}`,
    );
  }

  // Seed pins the scenario; unused for RNG — documents reproducibility contract.
  if (req.seed !== "fixture-test-1") {
    return result(req, "rejected", `unknown seed: ${req.seed} (v0.1 only supports fixture-test-1)`);
  }

  if (req.procedure === "baseline_insert") {
    // Constructed failure: high insertion force causes slip on this fixture.
    if (req.forceN >= 10) {
      return result(req, "slip", "baseline force causes connector slip (constructed)");
    }
    // Lower baseline still not the approved recovery procedure in this demo.
    return result(req, "slip", "baseline_insert is not the approved recovery procedure (constructed)");
  }

  // reduced_force_insert
  if (req.forceN <= 8) {
    return result(
      req,
      "success",
      "reduced_force_insert within safe envelope succeeds (constructed)",
    );
  }
  return result(
    req,
    "slip",
    "reduced_force_insert with forceN > 8 still slips in this constructed scenario",
  );
}

function result(
  req: SimulationRequest,
  outcome: SimulationResult["outcome"],
  reason: string,
): SimulationResult {
  return {
    outcome,
    reason,
    seed: req.seed,
    fixture: req.fixture,
    procedure: req.procedure,
    forceN: req.forceN,
    constructed: true,
    disclaimer: DISCLAIMER,
  };
}

/** Convenience: Arm B / Arm A baseline under identical conditions. */
export function baselineScenario(overrides: Partial<SimulationRequest> = {}) {
  return runAssemblySimulation({
    seed: "fixture-test-1",
    fixture: "fixture-7",
    robotModel: "arm-x",
    gripper: "parallel-v1",
    material: "polymer-demo",
    procedure: "baseline_insert",
    forceN: 12,
    forceLimitN: 12,
    ...overrides,
  });
}

/** Approved recovery advisory from Arm A experience. */
export function memoryScenario(overrides: Partial<SimulationRequest> = {}) {
  return runAssemblySimulation({
    seed: "fixture-test-1",
    fixture: "fixture-7",
    robotModel: "arm-x",
    gripper: "parallel-v1",
    material: "polymer-demo",
    procedure: "reduced_force_insert",
    forceN: 8,
    forceLimitN: 12,
    ...overrides,
  });
}
