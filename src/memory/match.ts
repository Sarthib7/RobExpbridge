import {
  EVIDENCE_RANK,
  type Experience,
  type MatchResult,
  type QueryRequest,
} from "../domain/schema.js";
import { verifyDigest } from "./integrity.js";

const CRITICAL_CONTEXT_FIELDS = [
  "robotModel",
  "gripper",
  "material",
  "fixture",
  "forceLimitN",
] as const;

type CriticalField = (typeof CRITICAL_CONTEXT_FIELDS)[number];

function missingCritical(query: QueryRequest): CriticalField[] {
  const missing: CriticalField[] = [];
  for (const field of CRITICAL_CONTEXT_FIELDS) {
    const value = query.context[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }
  }
  return missing;
}

function isExpired(exp: Experience, now: Date): boolean {
  if (!exp.expiresAt) return false;
  return new Date(exp.expiresAt).getTime() <= now.getTime();
}

/**
 * Compatibility gates (fail closed):
 * - missing critical context → requires_review
 * - task / hardware / fixture / material / force envelope mismatch → incompatible
 * - revoked / expired / insufficient evidence / disallowed license → rejected
 * Never substitutes text similarity for a safety constraint.
 */
export function evaluateMatch(
  experience: Experience,
  query: QueryRequest,
  now: Date = new Date(),
): MatchResult {
  const integrity = verifyDigest(experience);
  if (!integrity.ok) {
    return {
      status: "rejected",
      experienceId: experience.id,
      reasons: [integrity.reason],
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  if (experience.revoked) {
    return {
      status: "rejected",
      experienceId: experience.id,
      reasons: ["experience revoked"],
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  if (isExpired(experience, now)) {
    return {
      status: "rejected",
      experienceId: experience.id,
      reasons: [`experience expired at ${experience.expiresAt}`],
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  const missing = missingCritical(query);
  if (missing.length > 0) {
    return {
      status: "requires_review",
      experienceId: experience.id,
      reasons: missing.map((f) => `missing required context: ${f}`),
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  const reasons: string[] = [];

  if (query.task !== experience.task) {
    reasons.push(`task mismatch: query=${query.task} experience=${experience.task}`);
  }
  if (query.context.robotModel !== experience.context.robotModel) {
    reasons.push(
      `robotModel mismatch: query=${query.context.robotModel} experience=${experience.context.robotModel}`,
    );
  }
  if (query.context.gripper !== experience.context.gripper) {
    reasons.push(
      `gripper mismatch: query=${query.context.gripper} experience=${experience.context.gripper}`,
    );
  }
  if (query.context.material !== experience.context.material) {
    reasons.push(
      `material mismatch: query=${query.context.material} experience=${experience.context.material}`,
    );
  }
  if (query.context.fixture !== experience.context.fixture) {
    reasons.push(
      `fixture mismatch: query=${query.context.fixture} experience=${experience.context.fixture}`,
    );
  }

  // Safe parameter envelope: advisory force must be within querier's limit.
  const forceLimit = query.context.forceLimitN!;
  if (experience.advisory.forceN > forceLimit) {
    reasons.push(
      `force envelope exceeded: advisory forceN=${experience.advisory.forceN} > forceLimitN=${forceLimit}`,
    );
  }
  if (experience.context.forceLimitN < experience.advisory.forceN) {
    reasons.push(
      `experience force envelope inconsistent: forceLimitN=${experience.context.forceLimitN} < advisory forceN=${experience.advisory.forceN}`,
    );
  }

  if (reasons.length > 0) {
    return {
      status: "incompatible",
      experienceId: experience.id,
      reasons,
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  if (!query.acceptedLicenses.includes(experience.rights.license)) {
    return {
      status: "rejected",
      experienceId: experience.id,
      reasons: [
        `license not permitted: ${experience.rights.license} (accepted: ${query.acceptedLicenses.join(", ")})`,
      ],
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  const minRank = EVIDENCE_RANK[query.minEvidence];
  const expRank = EVIDENCE_RANK[experience.evidence.level];
  if (expRank < minRank) {
    return {
      status: "rejected",
      experienceId: experience.id,
      reasons: [
        `evidence below minimum: ${experience.evidence.level} < required ${query.minEvidence}`,
      ],
      evidenceLevel: experience.evidence.level,
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    };
  }

  return {
    status: "compatible",
    experienceId: experience.id,
    reasons: [
      "task, robotModel, gripper, material, fixture and force envelope match",
      `evidence level ${experience.evidence.level} meets minimum ${query.minEvidence}`,
      `license ${experience.rights.license} accepted`,
    ],
    evidenceLevel: experience.evidence.level,
    advisory: experience.advisory,
    provenance: {
      organization: experience.contributor.organization,
      machineId: experience.contributor.machineId,
      createdAt: experience.createdAt,
      rights: experience.rights,
    },
    advisoryOnly: true,
    disclaimer:
      "Simulated/constructed outcome. Does not establish real-world performance or safety.",
  };
}

export interface QueryOutcome {
  result: MatchResult;
  candidatesChecked: number;
  queryTimeMs: number;
}

/**
 * Scan store; return first compatible match, else best explanatory rejection.
 * Prefer incompatible/requires_review explanations over silent empty success.
 */
export function queryExperiences(
  experiences: Experience[],
  query: QueryRequest,
  now: Date = new Date(),
): QueryOutcome {
  const started = performance.now();
  const evaluations = experiences.map((exp) => evaluateMatch(exp, query, now));

  const compatible = evaluations.find((r) => r.status === "compatible");
  if (compatible) {
    return {
      result: compatible,
      candidatesChecked: evaluations.length,
      queryTimeMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  // Prefer explicit hardware incompatibility (e.g. gripper) for demo clarity.
  const incompatible = evaluations.find((r) => r.status === "incompatible");
  if (incompatible) {
    return {
      result: incompatible,
      candidatesChecked: evaluations.length,
      queryTimeMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  const review = evaluations.find((r) => r.status === "requires_review");
  if (review) {
    return {
      result: review,
      candidatesChecked: evaluations.length,
      queryTimeMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  const rejected = evaluations.find((r) => r.status === "rejected");
  if (rejected) {
    return {
      result: rejected,
      candidatesChecked: evaluations.length,
      queryTimeMs: Number((performance.now() - started).toFixed(3)),
    };
  }

  return {
    result: {
      status: "rejected",
      reasons: ["no experiences in store"],
      advisoryOnly: true,
      disclaimer:
        "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    },
    candidatesChecked: 0,
    queryTimeMs: Number((performance.now() - started).toFixed(3)),
  };
}
