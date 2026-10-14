import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from '../src/memory/match.js';
import { seal, verify } from '../src/memory/integrity.js';
import { demoExperience } from '../src/sim/experience.js';
import { fixture, runSimulation } from '../src/sim/assembly.js';
import type { Query } from '../src/domain/schema.js';

// Fixed evaluation time makes expiry checks repeatable across runs.
const evaluatedAt = new Date('2026-10-13T00:00:00.000Z');
const record = seal(demoExperience());
const query: Query = { task: 'connector_insertion', context: { ...fixture }, use: 'synthetic-demo' };
type Case = { id: string; input: unknown; query: Query; expected: string; reason?: string; simulation?: boolean; repeat?: boolean };
const { fixture: omittedFixture, ...partialContext } = fixture;
const { rights: omittedRights, ...withoutRights } = record;
const cases: Case[] = [
  { id: 'baseline-and-approved-recovery', input: record, query, expected: 'compatible', simulation: true },
  { id: 'incompatible-gripper', input: record, query: { ...query, context: { ...fixture, gripper: 'vacuum-v2' } }, expected: 'incompatible', reason: 'gripper mismatch' },
  { id: 'fixture-mismatch', input: record, query: { ...query, context: { ...fixture, fixture: 'fixture-other' } }, expected: 'incompatible', reason: 'fixture mismatch' },
  { id: 'missing-context', input: record, query: { ...query, context: partialContext }, expected: 'requires_review', reason: 'missing fixture' },
  { id: 'tampered-digest', input: { ...record, advisory: { ...record.advisory, forceN: 9 } }, query, expected: 'rejected', reason: 'integrity verification failed' },
  { id: 'expired-record', input: seal({ ...demoExperience(), expiresAt: '2020-01-01T00:00:00.000Z' }), query, expected: 'rejected', reason: 'record expired or revoked' },
  { id: 'revoked-record', input: seal({ ...demoExperience(), revoked: true }), query, expected: 'rejected', reason: 'record expired or revoked' },
  { id: 'low-evidence', input: seal({ ...demoExperience(), evidence: { ...record.evidence, level: 'observed' } }), query, expected: 'rejected', reason: 'insufficient simulation evidence' },
  { id: 'force-envelope', input: record, query: { ...query, context: { ...fixture, forceLimitN: 7 } }, expected: 'incompatible', reason: 'force envelope mismatch' },
  { id: 'wrong-task', input: record, query: { ...query, task: 'unrelated-task' }, expected: 'incompatible', reason: 'task mismatch' },
  { id: 'missing-record-rights', input: withoutRights, query, expected: 'rejected', reason: 'integrity verification failed' },
  { id: 'repeat-identical-fixture', input: record, query, expected: 'compatible', simulation: true, repeat: true },
];

const results = cases.map(item => {
  const decision = match(item.input, item.query, evaluatedAt);
  const simulation = item.simulation && decision.advisory ? {
    baseline: runSimulation(item.query.context),
    recovery: runSimulation(item.query.context, decision.advisory),
  } : null;
  const repeat = item.repeat && decision.advisory ? {
    baseline: runSimulation(item.query.context), recovery: runSimulation(item.query.context, decision.advisory),
  } : null;
  const expected = { verdict: item.expected, ...(item.reason ? { reason: item.reason } : {}), ...(item.simulation ? { baseline: 'slip', recovery: 'success' } : {}), ...(item.repeat ? { identicalResults: true } : {}) };
  const actual = { verdict: decision.status, reasons: decision.reasons, ...(simulation ? { baseline: simulation.baseline.outcome, recovery: simulation.recovery.outcome } : {}), ...(item.repeat ? { identicalResults: JSON.stringify(simulation) === JSON.stringify(repeat) } : {}) };
  const input = item.input as typeof record;
  const passed = decision.status === item.expected
    && (!item.reason || decision.reasons.includes(item.reason))
    && (!item.simulation || (simulation?.baseline.outcome === 'slip' && simulation.recovery.outcome === 'success'))
    && (!item.repeat || JSON.stringify(simulation) === JSON.stringify(repeat));
  return {
    id: item.id, provenance: 'VERIFIED', expected, actual, passed,
    recordDigest: input.integrity?.sha256 ?? null, recordIntegrityValid: verify(item.input),
    inputContext: item.query.context, inputQuery: item.query, inputRecord: item.input,
    simulationResult: simulation, repeatedSimulationResult: repeat,
  };
});
const passed = results.filter(result => result.passed).length;
const output = {
  evidenceKind: 'constructed-simulation-checks', provenance: 'VERIFIED',
  generatedAt: new Date().toISOString(), evaluationTime: evaluatedAt.toISOString(),
  command: 'node --import tsx scripts/simulation-batches.ts',
  scope: 'Twelve constructed checks of the existing simulator and compatibility rules. These are not devnet payment runs.',
  limitations: 'Synthetic fixtures only. No physical robot commands, payment transactions, real-world performance measurements, or safety validation.',
  paymentTransactions: 0, machineIdentity: 'synthetic-arm-a', total: results.length, passed, failed: results.length - passed,
  results,
};
const outputDir = join('data', 'evidence');
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'simulation-batches.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ evidenceKind: output.evidenceKind, total: results.length, passed, failed: output.failed, paymentTransactions: 0, output: join(outputDir, 'simulation-batches.json') }, null, 2));
if (passed !== 12 || results.length !== 12) process.exitCode = 1;
