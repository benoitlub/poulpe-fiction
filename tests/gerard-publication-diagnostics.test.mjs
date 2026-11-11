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
