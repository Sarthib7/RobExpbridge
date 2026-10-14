import test from 'node:test';
import assert from 'node:assert/strict';
import { experienceSchema, type Experience } from '../src/domain/schema.js';
import { fixture, runSimulation } from '../src/sim/assembly.js';
import { seal, verify } from '../src/memory/integrity.js';
import { match } from '../src/memory/match.js';
import { licenseReceipt } from '../src/economics/peaq.js';

const now = new Date('2026-01-01T00:00:00Z');
function experience(): Experience {
  return {
    schemaVersion: '0.1', id: 'synthetic-recovery-1',
    contributor: { organization: 'synthetic-lab', machineId: 'synthetic-arm-a' },
    task: 'connector_insertion', context: { ...fixture },
    failure: { procedure: 'baseline_insert', outcome: 'slip' },
    advisory: { procedure: 'reduced_force_insert', forceN: 8 },
    evidence: { level: 'simulation-tested', testId: 'fixture-test-1', attempts: 1, successes: 1 },
    rights: { license: 'demo-only', redistribution: false, permittedUse: 'synthetic-demo' },
    expiresAt: '2099-01-01T00:00:00Z', revoked: false,
  };
}
const query = () => ({ task: 'connector_insertion', context: { ...fixture }, use: 'synthetic-demo' as const });

test('baseline fails and approved recovery succeeds under identical constructed conditions', () => {
  const baseline = runSimulation(fixture);
  const recovery = runSimulation(fixture, experience().advisory);
  assert.equal(baseline.outcome, 'slip');
  assert.equal(recovery.outcome, 'success');
  assert.equal(baseline.seed, recovery.seed);
  assert.equal(baseline.fixture, recovery.fixture);
  assert.equal(recovery.evidenceLabel, 'simulation-tested');
  assert.equal(recovery.constructed, true);
  assert.deepEqual(runSimulation(fixture), baseline);
});

test('matching context returns a typed advisory with contributor provenance', () => {
  const result = match(seal(experience()), query(), now);
  assert.equal(result.status, 'compatible');
  assert.deepEqual(result.advisory, experience().advisory);
  assert.equal('advisoryOnly' in result && result.advisoryOnly, true);
  assert.deepEqual('contributor' in result && result.contributor, experience().contributor);
});

test('different gripper or fixture fails compatibility', () => {
  for (const key of ['gripper', 'fixture'] as const) {
    const request = query();
    request.context[key] = 'different';
    const result = match(seal(experience()), request, now);
    assert.equal(result.status, 'incompatible');
    assert.ok(result.reasons.includes(`${key} mismatch`));
    assert.equal(result.advisory, null);
  }
});

test('missing critical context requires review', () => {
  const result = match(seal(experience()), { task: 'connector_insertion', context: { gripper: fixture.gripper }, use: 'synthetic-demo' }, now);
  assert.equal(result.status, 'requires_review');
  assert.ok(result.reasons.includes('missing fixture'));
  assert.equal(result.advisory, null);
});

test('expired, revoked, observed, and unsuccessful evidence records are rejected', () => {
  const changes: Partial<Experience>[] = [
    { expiresAt: now.toISOString() }, { revoked: true },
    { evidence: { ...experience().evidence, level: 'observed' } },
    { evidence: { ...experience().evidence, successes: 0 } },
  ];
  for (const change of changes) {
    const result = match(seal({ ...experience(), ...change }), query(), now);
    assert.equal(result.status, 'rejected');
    assert.equal(result.advisory, null);
  }
});

test('tampered content fails its digest and cannot be recommended', () => {
  const record = seal(experience());
  record.contributor.machineId = 'tampered-machine';
  assert.equal(verify(record), false);
  assert.equal(match(record, query(), now).status, 'rejected');
});

test('canonical sealing is independent of object key order', () => {
  const original = experience();
  const reordered: { [key: string]: unknown } = Object.fromEntries(Object.entries(original).reverse());
  reordered.context = Object.fromEntries(Object.entries(original.context).reverse());
  const record = seal(reordered);
  assert.equal(record.integrity.sha256, seal(original).integrity.sha256);
  assert.equal(verify(record), true);
});

test('malformed experiences fail schema validation', () => {
  for (const value of [
    { ...experience(), unknownField: true },
    { ...experience(), evidence: { ...experience().evidence, successes: 2 } },
    { ...experience(), advisory: { procedure: 'execute_robot', forceN: 8 } },
    { ...experience(), context: { ...fixture, forceLimitN: 13 } },
  ]) assert.equal(experienceSchema.safeParse(value).success, false);
});

test('unsafe force and unreproduced recovery fail closed', () => {
  assert.throws(() => runSimulation({ ...fixture, forceLimitN: 7 }, experience().advisory), /force exceeds envelope/);
  assert.throws(() => runSimulation(fixture, { procedure: 'reduced_force_insert', forceN: 13 }));
  const unsafe = experience();
  unsafe.advisory.forceN = 11;
  assert.equal(match(seal(unsafe), query(), now).status, 'rejected');
  const request = query();
  request.context.forceLimitN = 7;
  assert.equal(match(seal(experience()), request, now).status, 'incompatible');
});

test('simulated economics is explicit and real settlement errors cannot return receipts', async () => {
  const receipt = await licenseReceipt('synthetic-recovery-1');
  assert.equal(receipt.status, 'simulated');
  assert.equal(receipt.transactionHash, null);
  assert.equal(receipt.network, 'none');
  await assert.rejects(licenseReceipt('synthetic-recovery-1', 'real'), /real peaq settlement is not configured/);
});

test('V1 fixed replay cannot attest inflated attempt counts', () => {
 const input = experience(); input.evidence.attempts = 1000000; input.evidence.successes = 1000000;
 assert.equal(match(seal(input), query(), now).status, 'rejected');
});
