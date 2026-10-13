import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { armAExperience, armAExperienceInput } from "../src/fixtures.js";
import { computeDigest, verifyDigest, withDigest } from "../src/memory/integrity.js";

describe("integrity digests", () => {
  it("computes stable sha256 excluding integrity field", () => {
    const exp = armAExperience();
    const again = computeDigest(exp);
    assert.equal(exp.integrity.sha256, again);
    assert.match(exp.integrity.sha256, /^[a-f0-9]{64}$/);
  });

  it("verifies untampered records", () => {
    const exp = armAExperience();
    const check = verifyDigest(exp);
    assert.equal(check.ok, true);
  });

  it("detects altered record bytes", () => {
    const exp = armAExperience();
    const tampered = {
      ...exp,
      advisory: { ...exp.advisory, forceN: 99 },
    };
    const check = verifyDigest(tampered);
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.match(check.reason, /digest verification failure/);
      assert.notEqual(check.expected, check.actual);
    }
  });

  it("digest changes when content changes", () => {
    const a = withDigest(armAExperienceInput({ id: "exp-a" }));
    const b = withDigest(armAExperienceInput({ id: "exp-b" }));
    assert.notEqual(a.integrity.sha256, b.integrity.sha256);
  });
});
