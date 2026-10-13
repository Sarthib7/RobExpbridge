import { createHash } from "node:crypto";
import type { Experience, ExperienceInput } from "../domain/schema.js";

/**
 * Recursively sort object keys for a stable JSON canonical form.
 * Arrays keep order; primitives are unchanged.
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** Serialize for hashing: canonical JSON without the integrity field. */
export function canonicalBytes(record: ExperienceInput | Experience | Record<string, unknown>): string {
  const clone: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  delete clone.integrity;
  return JSON.stringify(canonicalize(clone));
}

/** SHA-256 hex digest of canonical content excluding integrity. */
export function computeDigest(record: ExperienceInput | Experience | Record<string, unknown>): string {
  return createHash("sha256").update(canonicalBytes(record), "utf8").digest("hex");
}

export type VerifyResult =
  | { ok: true; digest: string }
  | { ok: false; expected: string; actual: string; reason: string };

/**
 * Verify integrity digest. Hashing proves integrity relative to a trusted digest,
 * not the truth of physical observations.
 */
export function verifyDigest(experience: Experience): VerifyResult {
  const actual = computeDigest(experience);
  const expected = experience.integrity.sha256;
  if (actual !== expected) {
    return {
      ok: false,
      expected,
      actual,
      reason: "digest verification failure: record bytes do not match integrity.sha256",
    };
  }
  return { ok: true, digest: actual };
}

/** Attach a freshly computed digest to an experience input. */
export function withDigest(input: ExperienceInput, createdAt?: string): Experience {
  const base: ExperienceInput = {
    ...input,
    createdAt: createdAt ?? input.createdAt ?? new Date().toISOString(),
    revoked: input.revoked ?? false,
  };
  const digest = computeDigest(base);
  return {
    ...base,
    createdAt: base.createdAt!,
    integrity: { sha256: digest },
  };
}
