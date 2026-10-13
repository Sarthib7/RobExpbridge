/**
 * One-command demo of ExperienceBridge v0.1.
 *
 * Arm A fails → publishes simulator-tested recovery →
 * Arm B baseline fails → queries → compatible advisory → succeeds →
 * Arm C rejected (gripper mismatch) → tamper rejected →
 * peaq license payment (simulated unless live credentials configured).
 *
 * Outcomes are constructed / deterministic — not real-world performance claims.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { armAExperienceInput, armBQuery, armCQuery } from "../src/fixtures.js";
import { PeaqAdapter } from "../src/economics/peaq.js";
import { queryExperiences } from "../src/memory/match.js";
import { verifyDigest } from "../src/memory/integrity.js";
import { JsonExperienceStore } from "../src/memory/store.js";
import { baselineScenario, memoryScenario } from "../src/sim/assembly.js";
import type { Experience } from "../src/domain/schema.js";

function line(title: string) {
  console.log("\n" + "─".repeat(64));
  console.log(title);
  console.log("─".repeat(64));
}

function metric(label: string, value: string | number) {
  console.log(`  ${label}: ${value}`);
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "eb-demo-"));
  const store = new JsonExperienceStore(path.join(dir, "experiences.json"));
  const peaq = new PeaqAdapter();
  const metrics = {
    baselineFailures: 0,
    memorySuccesses: 0,
    rejections: 0,
    queryTimeMs: 0,
  };

  try {
    console.log("ExperienceBridge v0.1 — deterministic three-arm demo");
    console.log(
      "Disclaimer: constructed simulator outcomes. Not real-world safety or performance proof.",
    );
    console.log("Advisory-only: no physical robot commands are issued.");

    line("1) Arm A — Factory A baseline (constructed slip)");
    const armAFail = baselineScenario();
    metric("machine", "arm-a / parallel-v1");
    metric("procedure", armAFail.procedure);
    metric("forceN", armAFail.forceN);
    metric("outcome", armAFail.outcome);
    metric("reason", armAFail.reason);
    if (armAFail.outcome === "slip") metrics.baselineFailures += 1;

    line("2) Arm A — reduced_force recovery succeeds in simulator");
    const armARecovery = memoryScenario();
    metric("procedure", armARecovery.procedure);
    metric("forceN", armARecovery.forceN);
    metric("outcome", armARecovery.outcome);
    metric("evidence label", "simulation-tested");

    line("3) Publish experience with provenance + integrity digest");
    const published = await store.publish(armAExperienceInput());
    const digestOk = verifyDigest(published);
    metric("id", published.id);
    metric("contributor", `${published.contributor.organization} / ${published.contributor.machineId}`);
    metric("evidence", published.evidence.level);
    metric("rights", `${published.rights.license} (redistribution=${published.rights.redistribution})`);
    metric("sha256", published.integrity.sha256);
    metric("integrity verified", String(digestOk.ok));

    line("4) Arm B — without memory (identical constructed conditions)");
    const armBBaseline = baselineScenario();
    metric("machine", "arm-b / parallel-v1");
    metric("outcome", armBBaseline.outcome);
    metric("reason", armBBaseline.reason);
    if (armBBaseline.outcome === "slip") metrics.baselineFailures += 1;

    line("5) Arm B — pre-execution query");
    const experiences = await store.list();
    const bQuery = queryExperiences(experiences, armBQuery());
    metrics.queryTimeMs = bQuery.queryTimeMs;
    metric("status", bQuery.result.status);
    metric("queryTimeMs", bQuery.queryTimeMs);
    metric("evidenceLevel", bQuery.result.evidenceLevel ?? "n/a");
    metric("advisory", JSON.stringify(bQuery.result.advisory));
    metric("provenance", JSON.stringify(bQuery.result.provenance));
    for (const r of bQuery.result.reasons) metric("reason", r);

    line("6) Arm B — applies advisory under same seed/fixture");
    const armBWithMemory = memoryScenario({
      procedure: bQuery.result.advisory?.procedure as "reduced_force_insert",
      forceN: bQuery.result.advisory?.forceN ?? 8,
    });
    metric("outcome", armBWithMemory.outcome);
    metric("reason", armBWithMemory.reason);
    metric("before/after", `${armBBaseline.outcome} → ${armBWithMemory.outcome}`);
    if (armBWithMemory.outcome === "success") metrics.memorySuccesses += 1;

    line("7) Arm C — vacuum-v2 gripper must be rejected");
    const cQuery = queryExperiences(experiences, armCQuery());
    metric("status", cQuery.result.status);
    for (const r of cQuery.result.reasons) metric("reason", r);
    if (cQuery.result.status === "incompatible") metrics.rejections += 1;

    line("8) Tamper detection");
    const tampered = {
      ...published,
      advisory: { ...published.advisory, forceN: 99 },
    } as Experience;
    const tamperCheck = verifyDigest(tampered);
    metric("tampered digest ok", String(tamperCheck.ok));
    if (!tamperCheck.ok) {
      metric("reason", tamperCheck.reason);
      metrics.rejections += 1;
    }

    line("9) peaq license payment (truthful mode)");
    const receipt = await peaq.payForLicense({
      experienceId: published.id,
      payerMachineId: "arm-b",
      payeeOrganization: published.contributor.organization,
      license: published.rights.license,
      idempotencyKey: `demo-${published.id}-arm-b`,
    });
    metric("status", receipt.status);
    metric("mode", receipt.mode);
    metric("transactionHash", String(receipt.transactionHash));
    metric("explorerUrl", String(receipt.explorerUrl));
    if (receipt.status === "simulated") metric("note", receipt.note);
    if (receipt.status === "error") metric("error", receipt.error);

    line("Measured demo metrics (constructed scenario — not statistical efficacy)");
    metric("baseline failures observed", metrics.baselineFailures);
    metric("memory-assisted successes", metrics.memorySuccesses);
    metric("rejection events (Arm C + tamper)", metrics.rejections);
    metric("Arm B query time (ms)", metrics.queryTimeMs);
    metric(
      "constructed success ratio with memory",
      metrics.memorySuccesses === 1 && armBBaseline.outcome === "slip" ? "1/1 after 0/1 baseline" : "unexpected",
    );

    console.log("\nDone. peaq is simulated unless live testnet credentials are configured.");
    console.log("No TEE / dstack confidentiality is claimed in this MVP.\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
