import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { armAExperienceInput } from "../src/fixtures.js";
import { JsonExperienceStore } from "../src/memory/store.js";

describe("JSON experience store", () => {
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

  it("rejects duplicate ids", async () => {
    await store.publish(armAExperienceInput());
    await assert.rejects(
      () => store.publish(armAExperienceInput()),
      (err: Error & { code?: string }) => err.code === "DUPLICATE",
    );
  });
});
