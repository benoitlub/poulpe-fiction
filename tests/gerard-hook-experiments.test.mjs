import test from 'node:test';
import assert from 'node:assert/strict';
import { planHookExperiment, recordHookExperiment } from '../scripts/gerard-hook-experiments.mjs';
test('extracts standalone curiosity hook and measurable hypothesis', () => {
  const e = planHookExperiment({ harvestId: 'terra-1', copyText: 'Et si la Terre nous observait ?\nDécouvrez TERRA.' });
  assert.equal(e.status, 'hypothesis-prepared');
  assert.equal(e.angle, 'curiosity-question');
  assert.ok(e.metrics.includes('shares'));
});
test('does not invent metrics for missing copy', () => {
  const e = planHookExperiment({ seedId: 's1' });
  assert.equal(e.status, 'missing-copy');
});
test('idempotently records experiments', () => {
  const e = planHookExperiment({ seedId: 's1', copyText: 'Découvrez TERRA' });
  const once = recordHookExperiment({}, e);
  assert.deepEqual(recordHookExperiment(once, e), once);
});
