import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicHandler } from '../src/public-worker.js';
import { fixture } from '../src/sim/assembly.js';
const serve=createPublicHandler({'/':'<h1>Preview</h1>'},'Evidence: blocked',{status:'blocked'});
const post=(path:string,body:unknown,headers:Record<string,string>={})=>serve(new Request('https://exbridge.world'+path,{method:'POST',headers:{'Content-Type':'application/json','x-experiencebridge-client':'local-ui',...headers},body:JSON.stringify(body)}));
test('V8 public preview runs synthetic recovery and rejects incompatible hardware',async()=>{
 const baseline=await post('/simulation/run',{context:fixture});assert.equal((await baseline.json()).outcome,'slip');
 const recovery=await post('/api/demo/recovery',{context:fixture});const result=await recovery.json();assert.equal(result.outcome,'success');assert.equal(result.paymentSent,false);
 assert.equal((await post('/api/demo/recovery',{context:{...fixture,gripper:'vacuum-v2'}})).status,422);
 assert.equal((await post('/api/demo/recovery',{context:{}})).status,400);
});
test('V8 public preview has no payment signing surface and blocks cross-origin mutations',async()=>{
 for(const path of ['/api/orders','/api/orders/example/pay','/api/orders/example/run']) assert.equal((await post(path,{})).status,403);
 assert.equal((await post('/api/demo/recovery',{context:fixture},{origin:'https://foreign.example'})).status,403);
 const config=await(await serve(new Request('https://exbridge.world/api/config'))).json();assert.equal(config.publicDemo,true);assert.equal(config.mode,'public-demo');
 assert.equal(await(await serve(new Request('https://exbridge.world/evidence'))).text(),'Evidence: blocked');
});


test('V12 public preview cancels an oversized stream before reading its tail', async () => {
 let reads = 0, cancelled = false;
 const body = new ReadableStream<Uint8Array>({
  pull(controller) {
   reads++;
   controller.enqueue(new TextEncoder().encode(reads === 1 ? ' '.repeat(16_385) : '{}'));
   if (reads === 2) controller.close();
  },
  cancel() { cancelled = true; },
 }, { highWaterMark: 0 });
 const request = new Request('https://exbridge.world/api/demo/publish', {
  method: 'POST', headers: { 'x-experiencebridge-client': 'local-ui' }, body, duplex: 'half',
 } as RequestInit & { duplex: 'half' });
 const response = await serve(request);
 assert.equal(response.status, 413);
 assert.equal(cancelled, true);
 assert.equal(reads, 1);
});

test('V12 public limit counts UTF-8 bytes rather than string characters', async () => {
 const input = { pad: 'é'.repeat(8192) };
 assert.ok(JSON.stringify(input).length < 16_384);
 const response = await post('/api/demo/publish', input);
 assert.equal(response.status, 413);
});

test('V12 public preview accepts valid JSON at the byte limit', async () => {
 const response = await serve(new Request('https://exbridge.world/api/demo/publish', {
  method: 'POST', headers: { 'x-experiencebridge-client': 'local-ui' }, body: '{}' + ' '.repeat(16_382),
 }));
 assert.equal(response.status, 200);
 assert.equal((await response.json()).id, 'exp-001');
});


test('V12 public limit accumulates bytes across chunks', async () => {
 let reads = 0, cancelled = false;
 const body = new ReadableStream<Uint8Array>({
  pull(controller) {
   reads++;
   controller.enqueue(new TextEncoder().encode(reads <= 2 ? ' '.repeat(10_000) : '{}'));
   if (reads === 3) controller.close();
  },
  cancel() { cancelled = true; },
 }, { highWaterMark: 0 });
 const response = await serve(new Request('https://exbridge.world/api/demo/publish', {
  method: 'POST', headers: { 'x-experiencebridge-client': 'local-ui' }, body, duplex: 'half',
 } as RequestInit & { duplex: 'half' }));
 assert.equal(response.status, 413);
 assert.equal(cancelled, true);
 assert.equal(reads, 2);
});
