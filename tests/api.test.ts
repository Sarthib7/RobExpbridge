import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { armAExperienceInput } from "../src/fixtures.js";
import { JsonExperienceStore } from "../src/memory/store.js";
import { buildServer } from "../src/server.js";

describe("HTTP API", () => {
  let dir: string;
  let store: JsonExperienceStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "eb-api-"));
    store = new JsonExperienceStore(path.join(dir, "experiences.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("health reports service and peaq mode", async () => {
    const { app } = await buildServer({ store });
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, "experiencebridge");
    assert.equal(body.peaqMode, "simulated");
    await app.close();
  });

  it("query returns compatible for Arm B and gripper mismatch for Arm C", async () => {
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
    assert.equal(b.json().status, "compatible");
    assert.equal(b.json().advisory.forceN, 8);

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
    assert.equal(c.json().status, "incompatible");
    assert.ok(c.json().reasons.some((r: string) => r.includes("gripper mismatch")));
    await app.close();
  });

  it("simulation run returns constructed baseline slip", async () => {
    const { app } = await buildServer({ store });
    const res = await app.inject({
      method: "POST",
      url: "/simulation/run",
      payload: {
        procedure: "baseline_insert",
        forceN: 12,
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().outcome, "slip");
    assert.equal(res.json().constructed, true);
    await app.close();
  });
});
