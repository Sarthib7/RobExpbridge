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
