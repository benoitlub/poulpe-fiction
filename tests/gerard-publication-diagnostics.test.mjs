import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosePublication, analyticsHealth } from '../scripts/gerard-publication-diagnostics.mjs';
test('missing Buffer token and assets are explicit', () => {
 const d=diagnosePublication({harvestId:'h',status:'ready',copy:{text:'hello'},transport:{provider:'buffer'}});
 assert.ok(d.issues.some(i=>i.code==='BUFFER_TOKEN_MISSING'));
 assert.ok(d.issues.some(i=>i.code==='BUFFER_MEDIA_MISSING'));
 assert.equal(d.publicationConfirmed,false);
});
test('Metricool mail sent is not a published post', () => {
 const d=diagnosePublication({harvestId:'h',seedId:'s',status:'ready',copy:{text:'hello'},transport:{provider:'metricool'},editorialRoute:{destination:{preferredProvider:'metricool'}},compatibleNetworks:['facebook'],metricoolHandoff:{status:'mail-sent'}});
 assert.ok(d.issues.some(i=>i.code==='METRICOOL_PROVIDER_UNCONFIRMED'));
 assert.equal(d.publicationConfirmed,false);
});
test('historical analytics are stale', () => {
 assert.equal(analyticsHealth({}, {snapshotCheckedAt:'2026-10-29T00:00:00Z'},new Date('2026-11-11T12:00:00Z')).providerMetrics,'stale-or-unavailable');
});
test('Publisher-resolved channel and unknown learning credentials are not missing configuration', () => {
 const d=diagnosePublication({harvestId:'h',status:'ready',copy:{text:'book'},transport:{provider:'buffer'},media:{url:'https://example.test/cover.jpg'},bufferPreflight:{status:'ready-for-controlled-test',channelId:'verified-channel'},action:'hold-for-buffer-draft'}, {bufferTokenPresent:null});
 assert.deepEqual(d.issues,[]);
 assert.equal(d.state,'eligible-for-provider-check');
});
test('a provider-confirmed delivery is terminal even when the next-write action has changed', () => {
 for(const status of ['confirmed-scheduled','confirmed-published']) {
  const d=diagnosePublication({harvestId:'h',transport:{provider:'buffer'},action:'buffer-publication-confirmed',delivery:{status,postId:'verified-post'}},{bufferTokenPresent:null});
  assert.equal(d.state,status);assert.equal(d.publicationConfirmed,true);assert.deepEqual(d.issues,[]);
 }
 assert.equal(diagnosePublication({delivery:{status:'confirmed-published'}}).publicationConfirmed,false);
});

test('empty delivery, blocked content and already-reserved mail cannot make a successful diffusion run', async () => {
 const {deliveryRunOutcome}=await import('../scripts/gerard-publication-diagnostics.mjs');
 for (const c of [{},{status:'blocked'}, {metricoolHandoff:{status:'mail-already-reserved'}}, {delivery:{status:'confirmed-scheduled'}}])
  assert.equal(deliveryRunOutcome(c).failed,true);
 assert.deepEqual(deliveryRunOutcome({metricoolHandoff:{status:'mail-sent'}}),{status:'awaiting-external-confirmation',confirmed:false,failed:false});
 assert.equal(deliveryRunOutcome({delivery:{status:'confirmed-published',postId:'real-post'}}).confirmed,true);
});
