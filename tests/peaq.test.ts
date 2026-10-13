import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PeaqAdapter } from "../src/economics/peaq.js";

describe("peaq payment adapter", () => {
  it("returns explicitly simulated receipt by default", async () => {
    const adapter = new PeaqAdapter({ mode: "simulated", enabled: false });
    const receipt = await adapter.payForLicense({
      experienceId: "exp-001",
      payerMachineId: "arm-b",
      payeeOrganization: "factory-a",
      license: "demo-only",
      idempotencyKey: "demo-key-1",
    });
    assert.equal(receipt.status, "simulated");
    assert.equal(receipt.transactionHash, null);
    assert.equal(receipt.explorerUrl, null);
    if (receipt.status === "simulated") {
      assert.match(receipt.note, /SIMULATED/);
    }
  });

  it("live misconfiguration never produces a fake success receipt", async () => {
    const adapter = new PeaqAdapter({ mode: "live", enabled: true });
    const receipt = await adapter.payForLicense({
      experienceId: "exp-001",
      payerMachineId: "arm-b",
      payeeOrganization: "factory-a",
      license: "demo-only",
      idempotencyKey: "demo-key-2",
    });
    assert.equal(receipt.status, "error");
    assert.equal(receipt.transactionHash, null);
    assert.equal(receipt.explorerUrl, null);
  });

  it("live with credentials still refuses fabricated success in v0.1", async () => {
    const adapter = new PeaqAdapter({
      mode: "live",
      enabled: true,
      rpcUrl: "https://example.invalid",
      seed: "test-only-not-a-real-mnemonic",
    });
    const receipt = await adapter.payForLicense({
      experienceId: "exp-001",
      payerMachineId: "arm-b",
      payeeOrganization: "factory-a",
      license: "demo-only",
      idempotencyKey: "demo-key-3",
    });
    assert.equal(receipt.status, "error");
    assert.equal(receipt.transactionHash, null);
  });
});
