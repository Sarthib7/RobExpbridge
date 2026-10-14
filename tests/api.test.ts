import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/memory/store.js';
import { buildServer } from '../src/server.js';
import { seal } from '../src/memory/integrity.js';
import { fixture } from '../src/sim/assembly.js';
import { demoExperience } from '../src/sim/experience.js';
test('API persists provenance, queries before simulation and rejects bypasses', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'eb-test-')); const path = join(dir, 'records.json');
 const app = buildServer(new Store(path));
 try {
 const call = (url: string, payload: unknown) => app.inject({ method:'POST', url, payload: JSON.stringify(payload), headers: { "content-type": "application/json" } });
 assert.equal((await call('/experiences', {})).statusCode, 400);
 assert.equal((await call('/experiences', demoExperience())).statusCode, 201);
 assert.equal((await call('/experiences', demoExperience())).statusCode, 409);
 assert.equal((await new Store(path).all())[0].contributor.machineId, 'synthetic-arm-a');
 assert.equal((await app.inject('/experiences/exp-001')).statusCode, 200);
 assert.equal((await app.inject('/experiences/missing')).statusCode, 404);
 assert.equal((await call('/experiences/query', { context: {} })).json().results[0].status, 'requires_review');
 assert.equal((await call('/simulation/run', { context: fixture })).json().outcome, 'slip');
 assert.equal((await call('/simulation/run', { context: fixture, experienceId:'exp-001' })).json().outcome, 'success');
 assert.equal((await call('/simulation/run', { context: {...fixture,gripper:'vacuum-v2'},experienceId:'exp-001' })).statusCode,422);
 assert.equal((await call('/simulation/run', { context: fixture, advisory: {procedure:'reduced_force_insert',forceN:8} })).statusCode,400);
 const rows = JSON.parse(await readFile(path,'utf8')); rows[0].revoked = true; await writeFile(path,JSON.stringify(rows));
 assert.equal((await call('/experiences/query', { task:'connector_insertion',context:fixture,use:'synthetic-demo' })).statusCode,500);
 assert.equal((await app.inject('/experiences/exp-001')).statusCode,500);
 } finally { await app.close(); }
});
test('publishing rejects expired and fabricated evidence', async () => {
 const dir = await mkdtemp(join(tmpdir(),'eb-test-')); const app = buildServer(new Store(join(dir,'r.json')));
 try {
 for (const record of [{...demoExperience(),expiresAt:'2000-01-01T00:00:00Z'}, {...demoExperience(),evidence:{...demoExperience().evidence,level:'observed'}}, {...demoExperience(),advisory:{procedure:'reduced_force_insert',forceN:11}}]) {
 assert.equal((await app.inject({method:'POST',url:'/experiences',payload:record})).statusCode,422);
 }
 } finally { await app.close(); }
});
test('concurrent publishes preserve both records; corrupt store is not overwritten', async () => {
 const dir = await mkdtemp(join(tmpdir(),'eb-test-')); const path = join(dir,'r.json'); const store = new Store(path);
 await Promise.all([store.publish(demoExperience()),store.publish({...demoExperience(),id:'exp-002'})]);
 assert.equal((await store.all()).length,2);
 await writeFile(path,'invalid'); await assert.rejects(store.publish({...demoExperience(),id:'exp-003'}));
 assert.equal(await readFile(path,'utf8'),'invalid');
});

test('V2 expired or revoked persisted records cannot run a recovery', async () => {
 const dir = await mkdtemp(join(tmpdir(),'eb-test-')); const path = join(dir,'r.json'); const app = buildServer(new Store(path));
 try {
 for (const record of [{...demoExperience(),expiresAt:'2000-01-01T00:00:00Z'}, {...demoExperience(),revoked:true}, {...demoExperience(),evidence:{...demoExperience().evidence,attempts:1000000,successes:1000000}}]) {
 await writeFile(path,JSON.stringify([seal(record)]));
 assert.equal((await app.inject({method:'POST',url:'/simulation/run',payload:{context:fixture,experienceId:'exp-001'}})).statusCode,422);
 }
 } finally { await app.close(); }
});
