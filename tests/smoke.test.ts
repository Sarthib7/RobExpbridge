import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SERVICE_NAME, VERSION } from "../src/version.js";

describe("scaffold smoke", () => {
  it("exports service identity", () => {
    assert.equal(SERVICE_NAME, "experiencebridge");
    assert.equal(VERSION, "0.1.0");
  });
});
