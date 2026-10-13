import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { armAExperienceInput } from "../src/fixtures.js";
import { JsonExperienceStore } from "../src/memory/store.js";
import { buildServer } from "../src/server.js";

describe("JSON store and HTTP API", () => {
  let dir: string;
  let store: JsonExperienceStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "eb-store-"));
    store = new JsonExperienceStore(path.join(dir, "experiences.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("publishes with computed digest and retrieves provenance", async () => {
    const published = await store.publish(armAExperienceInput());
    assert.match(published.integrity.sha256, /^[a-f0-9]{64}$/);
    const got = await store.get("exp-001");
    assert.equal(got?.contributor.organization, "factory-a");
  });

  it("HTTP query returns compatible for Arm B and gripper mismatch for Arm C", async () => {
    await store.publish(armAExperienceInput());
    const { app } = await buildServer({ store });

    const b = await app.inject({
      method: "POST",
      url: "/experiences/query",
      payload: {
        task: "connector_insertion",
        context: {
          robotModel: "arm-x",
          gripper: "parallel-v1",
          material: "polymer-demo",
          fixture: "fixture-7",
          forceLimitN: 12,
        },
      },
    });
    assert.equal(b.statusCode, 200);
    const bBody = b.json();
    assert.equal(bBody.status, "compatible");
    assert.equal(bBody.advisory.forceN, 8);

    const c = await app.inject({
      method: "POST",
      url: "/experiences/query",
      payload: {
        task: "connector_insertion",
        context: {
          robotModel: "arm-x",
          gripper: "vacuum-v2",
          material: "polymer-demo",
          fixture: "fixture-7",
          forceLimitN: 12,
        },
      },
    });
    assert.equal(c.statusCode, 200);
    const cBody = c.json();
    assert.equal(cBody.status, "incompatible");
    assert.ok(cBody.reasons.some((r: string) => r.includes("gripper mismatch")));

    await app.close();
  });
});
