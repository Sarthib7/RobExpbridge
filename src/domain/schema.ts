import { z } from 'zod';
const text = z.string().min(1).max(100);
export const contextSchema = z.strictObject({ robotModel: text, gripper: text, connector: text, material: text, fixture: text, forceLimitN: z.number().positive().max(12) });
export const advisorySchema = z.strictObject({ procedure: z.literal('reduced_force_insert'), forceN: z.number().positive().max(12) });
export const experienceSchema = z.strictObject({
  schemaVersion: z.literal('0.1'), id: text,
  contributor: z.strictObject({ organization: text, machineId: text }),
  task: z.literal('connector_insertion'), context: contextSchema,
  failure: z.strictObject({ procedure: z.literal('baseline_insert'), outcome: z.literal('slip') }),
  advisory: advisorySchema,
  evidence: z.strictObject({ level: z.enum(['observed', 'simulation-tested', 'operator-approved', 'field-validated']), testId: z.literal('fixture-test-1'), attempts: z.number().int().positive(), successes: z.number().int().nonnegative() }),
  rights: z.strictObject({ license: z.literal('demo-only'), redistribution: z.literal(false), permittedUse: z.literal('synthetic-demo') }),
  expiresAt: z.iso.datetime(), revoked: z.boolean(),
}).refine(r => r.evidence.successes <= r.evidence.attempts, 'successes exceed attempts');
export const recordSchema = experienceSchema.extend({ integrity: z.strictObject({ sha256: z.string().regex(/^[a-f0-9]{64}$/) }) });
export const querySchema = z.strictObject({ task: text.optional(), context: contextSchema.partial().optional(), use: z.literal('synthetic-demo').optional() });
export type Experience = z.infer<typeof experienceSchema>;
export type Record = z.infer<typeof recordSchema>;
export type Query = z.infer<typeof querySchema>;
