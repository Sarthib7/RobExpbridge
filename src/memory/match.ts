import { querySchema, recordSchema, type Query, type Record } from '../domain/schema.js';
import { verify } from './integrity.js';
import { runSimulation } from '../sim/assembly.js';
export function match(input: unknown, queryInput: Query, now = new Date()) {
  const q = querySchema.parse(queryInput);
  const r = recordSchema.safeParse(input);
  const result = (status: 'rejected' | 'requires_review' | 'incompatible', reasons: string[]) => ({ status, reasons, advisory: null });
  if (!r.success || !verify(input)) return result('rejected', ['integrity verification failed']);
  const record = r.data;
  if (record.revoked || Date.parse(record.expiresAt) <= now.getTime()) return result('rejected', ['record expired or revoked']);
  if (record.evidence.level !== 'simulation-tested' || record.evidence.attempts !== 1 || record.evidence.successes !== 1) return result('rejected', ['insufficient simulation evidence']);
  try {
    if (runSimulation(record.context).outcome !== 'slip' || runSimulation(record.context, record.advisory).outcome !== 'success') return result('rejected', ['simulation evidence not reproduced']);
  } catch { return result('rejected', ['unsupported simulation context or force']); }
  const missing = ['task', 'use'].filter(k => q[k as 'task' | 'use'] === undefined);
  for (const key of Object.keys(record.context)) if (q.context?.[key as keyof Record['context']] === undefined) missing.push(key);
  if (missing.length) return result('requires_review', missing.map(k => 'missing ' + k));
  const reasons: string[] = [];
  if (q.task !== record.task) reasons.push('task mismatch');
  for (const key of ['robotModel', 'gripper', 'connector', 'material', 'fixture'] as const) if (q.context?.[key] !== record.context[key]) reasons.push(key + ' mismatch');
  if (q.context!.forceLimitN! < record.advisory.forceN || q.context!.forceLimitN! > record.context.forceLimitN) reasons.push('force envelope mismatch');
  if (reasons.length) return result('incompatible', reasons);
  return { status: 'compatible' as const, reasons: ['task, hardware, context, demo rights and simulation evidence match'], advisory: record.advisory, evidence: record.evidence, contributor: record.contributor, advisoryOnly: true };
}
