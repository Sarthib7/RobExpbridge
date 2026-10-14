import { type Experience } from '../domain/schema.js';
import { fixture } from './assembly.js';
export function demoExperience(): Experience {
  return { schemaVersion: '0.1', id: 'exp-001', contributor: { organization: 'synthetic-factory-a', machineId: 'synthetic-arm-a' }, task: 'connector_insertion', context: { ...fixture }, failure: { procedure: 'baseline_insert', outcome: 'slip' }, advisory: { procedure: 'reduced_force_insert', forceN: 8 }, evidence: { level: 'simulation-tested', testId: 'fixture-test-1', attempts: 1, successes: 1 }, rights: { license: 'demo-only', redistribution: false, permittedUse: 'synthetic-demo' }, expiresAt: '2099-01-01T00:00:00Z', revoked: false };
}
