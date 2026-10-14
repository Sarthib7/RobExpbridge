import { contextSchema, advisorySchema } from '../domain/schema.js';
export const fixture = { robotModel: 'arm-x', gripper: 'parallel-v1', connector: 'connector-demo', material: 'polymer-demo', fixture: 'fixture-7', forceLimitN: 12 };
export function runSimulation(context: unknown, advisory?: unknown) {
  const c = contextSchema.parse(context);
  const a = advisory === undefined ? undefined : advisorySchema.parse(advisory);
  if (Object.entries(fixture).some(([key, value]) => key !== 'forceLimitN' && c[key as keyof typeof c] !== value)) throw new Error('unsupported constructed fixture');
  const forceN = a?.forceN ?? 12;
  if (forceN > c.forceLimitN) throw new Error('force exceeds envelope');
  return { evidenceLabel: 'simulation-tested' as const, scenario: 'fixture-test-1', seed: 7, fixture: c.fixture, forceN, outcome: forceN >= 7 && forceN <= 9 ? 'success' as const : 'slip' as const, constructed: true };
}
