import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildServer } from '../src/server.js';
import { Store } from '../src/memory/store.js';
import { fixture } from '../src/sim/assembly.js';
import { demoExperience } from '../src/sim/experience.js';
import { verify } from '../src/memory/integrity.js';
import { licenseReceipt } from '../src/economics/peaq.js';
const directory = await mkdtemp(join(tmpdir(), 'experiencebridge-'));
const app = buildServer(new Store(join(directory, 'experiences.json')));
async function post(url: string, payload: unknown) {
  const response = await app.inject({ method: 'POST', url, payload: JSON.stringify(payload), headers: { "content-type": "application/json" } });
  assert.ok(response.statusCode < 300, response.body);
  return response.json();
}
try {
  const armA = await post('/simulation/run', { context: fixture });
  const record = await post('/experiences', demoExperience());
  const baseline = await post('/simulation/run', { context: fixture });
  const start = performance.now();
  const query = await post('/experiences/query', { task: 'connector_insertion', context: fixture, use: 'synthetic-demo' });
  const queryTimeMs = performance.now() - start;
  const recovered = await post('/simulation/run', { context: fixture, experienceId: record.id });
  const rejected = await post('/experiences/query', { task: 'connector_insertion', context: { ...fixture, gripper: 'vacuum-v2' }, use: 'synthetic-demo' });
  const tampered = structuredClone(record); tampered.advisory.forceN = 9;
  assert.equal(baseline.outcome, 'slip'); assert.equal(recovered.outcome, 'success');
  assert.equal(rejected.results[0].status, 'incompatible'); assert.equal(verify(tampered), false);
  console.log(JSON.stringify({ notice: 'Constructed synthetic outcomes. No real-world safety or effectiveness claim.', armA, provenance: record.contributor, evidence: record.evidence, armB: { baseline, decision: query.results[0], recovered }, armC: rejected.results[0], tamperingDetected: !verify(tampered), metrics: { queryTimeMs, baselineFailures: '1/1', recoverySuccesses: '1/1', repeatedFailuresAvoided: 1, incompatibleRejectionRate: '1/1' }, peaq: await licenseReceipt(record.id), privacy: 'No TEE integration or hardware attestation.', storePath: directory }, null, 2));
} finally { await app.close(); }
