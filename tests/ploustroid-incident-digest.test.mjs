import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestIncident, incidentDigest, resolveIncident, markNotified } from '../scripts/ploustroid-incident-digest.mjs';
const base = { id: 'run-1', fingerprint: 'publisher:timeout', at: '2026-11-11T10:00:00Z', severity: 'recoverable' };
test('deduplicates identical event and groups repeat failures', () => {
  const a = ingestIncident(undefined, base);
  assert.deepEqual(ingestIncident(a, base), a);
  const b = ingestIncident(a, { ...base, id: 'run-2', at: '2026-11-11T11:00:00Z' });
  assert.equal(b.incidents.length, 1);
  assert.equal(b.incidents[0].count, 2);
  assert.equal(incidentDigest(b).repeated.length, 1);
});
test('notifies only action-required once', () => {
  const a = ingestIncident(undefined, { ...base, severity: 'action-required' });
  assert.equal(incidentDigest(a).actionRequired.length, 1);
  assert.equal(incidentDigest(markNotified(a, base.fingerprint)).actionRequired.length, 0);
});
test('resolved incident is absent from digest', () => {
  const a = ingestIncident(undefined, base);
  assert.equal(incidentDigest(resolveIncident(a, base.fingerprint)).recoverable.length, 0);
});
