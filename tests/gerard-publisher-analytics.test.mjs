import test from 'node:test';
import assert from 'node:assert/strict';
import { probePublisher } from '../scripts/gerard-publisher-analytics.mjs';
test('retries transient error and records success', async () => {
 let calls=0;
 const r=await probePublisher(async()=>{calls++;return calls===1?{ok:false,status:503}:{ok:true,json:async()=>({status:'available'})}},async()=>{});
 assert.equal(r.status,'received'); assert.equal(calls,2);
});
test('reports timeout without treating it as analytics', async () => {
 const r=await probePublisher(async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'})},async()=>{});
 assert.equal(r.status,'unavailable'); assert.equal(r.reason,'timeout');
});
