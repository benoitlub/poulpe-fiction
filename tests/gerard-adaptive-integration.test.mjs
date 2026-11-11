import test from 'node:test';
import assert from 'node:assert/strict';
import { integrateAdaptiveEvidence } from '../scripts/gerard-learning-cycle.mjs';

test('opt-in adapter preserves evidence between cycles and changes advice', () => {
  const first = integrateAdaptiveEvidence({}, { parcelId: 'benoit', operationId: 'cycle-1' },
    { delivery: { status: 'blocked' } }, '2026-11-11T10:00:00Z');
  assert.equal(first.adaptiveEvidence.advice.action, 'diagnose-transport');
  const second = integrateAdaptiveEvidence(first, { parcelId: 'benoit', operationId: 'cycle-2' },
    { delivery: { status: 'not-attempted' } }, '2026-11-11T10:05:00Z');
  assert.equal(second.adaptiveEvents.events.length, 2);
  assert.deepEqual(second.adaptiveEvents.events.map(e => e.cycleId), ['cycle-1', 'cycle-2']);
  assert.equal(second.adaptiveEvidence.advice.action, 'verify-delivery');
  const repeated = integrateAdaptiveEvidence(first, { parcelId: 'benoit', operationId: 'cycle-1' },
    { delivery: { status: 'blocked' } }, '2026-11-11T11:00:00Z');
  assert.equal(repeated.adaptiveEvents.events.length, 1);
});
test('adapter does not invent parcel identity or transport evidence', () => {
  const unchanged = integrateAdaptiveEvidence({}, { seedId: 'seed' }, { delivery: { status: 'sent' } });
  assert.equal(unchanged.adaptiveEvidence.status, 'insufficient-evidence');
  assert.equal(unchanged.adaptiveEvents, undefined);
});
test('existing learning fields survive the adapter', () => {
  const original = { observations: [{ kind: 'legacy' }], guidance: { nextExperiment: 'original' } };
  const result = integrateAdaptiveEvidence(original, { parcelId: 'benoit', operationId: 'cycle-1' },
    { delivery: { status: 'failed' } }, '2026-11-11T10:00:00Z');
  assert.deepEqual(result.observations, original.observations);
  assert.deepEqual(result.guidance, original.guidance);
  assert.equal(result.adaptiveEvidence.advice.action, 'diagnose-transport');
});
