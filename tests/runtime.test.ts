import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime } from '../src/economics/runtime.js';

test('V3 one runtime owns each network directory, graceful close releases it', async () => {
 const dir = await mkdtemp(join(tmpdir(),'eb-runtime-'));
 const first = await createRuntime('local',dir);
 try {
  await assert.rejects(createRuntime('local',dir),/Another local runtime/);
  const otherNetwork = await createRuntime('agung',dir); await otherNetwork.close();
  assert.equal((await stat(join(dir,'test-wallets.json'))).mode & 0o777,0o600);
  assert.notEqual(first.gateway.buyerAddress,first.gateway.sellerAddress);
 } finally { await first.close(); }
 const again=await createRuntime('local',dir); await again.close();
});
test('failed runtime initialization releases its lock and preserves wallets', async () => {
 const dir = await mkdtemp(join(tmpdir(),'eb-runtime-'));
 await assert.rejects(createRuntime('local',dir,'https://example.com'),/loopback/);
 const original=await readFile(join(dir,'test-wallets.json'),'utf8');
 const good=await createRuntime('local',dir); await good.close();
 assert.equal(await readFile(join(dir,'test-wallets.json'),'utf8'),original);
});
