import { z } from "zod";

/** Evidence strength labels. Never silently upgrade. */
export const EvidenceLevelSchema = z.enum([
  "observed",
  "simulation-tested",
  "operator-approved",
  "field-validated",
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

/** Minimum evidence accepted for automatic recommendation. */
export const MIN_AUTO_EVIDENCE: EvidenceLevel = "simulation-tested";

export const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  observed: 0,
  "simulation-tested": 1,
  "operator-approved": 2,
  "field-validated": 3,
};

export const ContextSchema = z.object({
  robotModel: z.string().min(1),
  gripper: z.string().min(1),
  material: z.string().min(1),
  fixture: z.string().min(1),
  forceLimitN: z.number().positive(),
});
export type Context = z.infer<typeof ContextSchema>;

export const ContributorSchema = z.object({
  organization: z.string().min(1),
  machineId: z.string().min(1),
});

export const FailureSchema = z.object({
  procedure: z.string().min(1),
  outcome: z.string().min(1),
});

export const AdvisorySchema = z.object({
  procedure: z.string().min(1),
  forceN: z.number().positive(),
});

export const EvidenceSchema = z.object({
  level: EvidenceLevelSchema,
  testId: z.string().min(1),
  attempts: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
});

export const RightsSchema = z.object({
  license: z.string().min(1),
  redistribution: z.boolean(),
});

export const IntegritySchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

/** Publishable experience body before digest is attached. */
export const ExperienceInputSchema = z.object({
  schemaVersion: z.literal("0.1"),
  id: z.string().min(1),
  contributor: ContributorSchema,
  task: z.string().min(1),
  context: ContextSchema,
  failure: FailureSchema,
  advisory: AdvisorySchema,
  evidence: EvidenceSchema,
  rights: RightsSchema,
  /** ISO-8601 expiry; omitted means no expiry. */
  expiresAt: z.string().datetime().optional(),
  revoked: z.boolean().default(false),
  createdAt: z.string().datetime().optional(),
});
export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;

export const ExperienceSchema = ExperienceInputSchema.extend({
  createdAt: z.string().datetime(),
  integrity: IntegritySchema,
});
export type Experience = z.infer<typeof ExperienceSchema>;

/** Query from a robot before execution. Partial context → requires_review. */
export const QueryRequestSchema = z.object({
  task: z.string().min(1),
  context: z
    .object({
      robotModel: z.string().min(1).optional(),
      gripper: z.string().min(1).optional(),
      material: z.string().min(1).optional(),
      fixture: z.string().min(1).optional(),
      forceLimitN: z.number().positive().optional(),
    })
    .strict(),
  /** License types the querier is willing to accept. */
  acceptedLicenses: z.array(z.string().min(1)).default(["demo-only"]),
  /** Minimum evidence for auto-recommendation. */
  minEvidence: EvidenceLevelSchema.default(MIN_AUTO_EVIDENCE),
});
export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const MatchStatusSchema = z.enum([
  "compatible",
  "incompatible",
  "requires_review",
  "rejected",
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const MatchResultSchema = z.object({
  status: MatchStatusSchema,
  experienceId: z.string().optional(),
  reasons: z.array(z.string()),
  evidenceLevel: EvidenceLevelSchema.optional(),
  advisory: AdvisorySchema.optional(),
  provenance: z
    .object({
      organization: z.string(),
      machineId: z.string(),
      createdAt: z.string(),
      rights: RightsSchema,
    })
    .optional(),
  /** Advisory-only: never executable authority. */
  advisoryOnly: z.literal(true).default(true),
  disclaimer:
    z.literal(
      "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    ).default(
      "Simulated/constructed outcome. Does not establish real-world performance or safety.",
    ),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const SimulationRequestSchema = z.object({
  seed: z.string().default("fixture-test-1"),
  fixture: z.string().default("fixture-7"),
  robotModel: z.string().default("arm-x"),
  gripper: z.string().default("parallel-v1"),
  material: z.string().default("polymer-demo"),
  procedure: z.enum(["baseline_insert", "reduced_force_insert"]),
  forceN: z.number().positive(),
  forceLimitN: z.number().positive().default(12),
});
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

export const SimulationResultSchema = z.object({
  outcome: z.enum(["success", "slip", "rejected"]),
  reason: z.string(),
  seed: z.string(),
  fixture: z.string(),
  procedure: z.string(),
  forceN: z.number(),
  constructed: z.literal(true),
  disclaimer: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
