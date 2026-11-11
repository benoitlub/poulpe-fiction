import test from 'node:test';
import assert from 'node:assert/strict';
import { observeDiffusionMission } from '../scripts/ploustroid-observer.mjs';
const evidence = { status: 'observed', parcelId: 'terra', cycleId: 'run-1',
  updatedAt: '2026-11-11T10:00:00Z', advice: { action: 'diagnose-transport', evidenceIds: ['delivery:terra:run-1'] } };
test('failed delivery is blocked and persists across runs', () => {
  const a = observeDiffusionMission(undefined, evidence);
  assert.equal(a.state.missions[0].status, 'blocked');
  const b = observeDiffusionMission(a.state, evidence);
  assert.equal(b.state.missions.length, 1);
  assert.equal(b.summary.status, 'already-observed');
});
test('missing evidence does not invent work', () => {
  const a = observeDiffusionMission(undefined, { status: 'insufficient-evidence' });
  assert.equal(a.state.missions.length, 0);
});
test('delivery evidence completes observation, not a publication claim', () => {
  const a = observeDiffusionMission(undefined, { ...evidence,
    advice: { action: 'await-attributed-metrics', evidenceIds: ['delivery:terra:run-1'] } });
  assert.equal(a.state.missions[0].kind, 'delivery-observation');
  assert.equal(a.state.missions[0].status, 'completed');
  assert.equal(a.state.missions[0].evidenceId, 'delivery:terra:run-1');
});
