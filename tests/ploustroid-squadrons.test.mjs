import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueMission, transitionMission, squadronStatus } from '../scripts/ploustroid-squadrons.mjs';
const m = { id: 'm1', parcelId: 'terra', squadronId: 'diffusion', kind: 'draft', createdAt: '2026-11-11T10:00:00Z' };
test('mission idempotency and isolation', () => {
  const s = enqueueMission(undefined, m);
  assert.deepEqual(enqueueMission(s, m), s);
  assert.equal(squadronStatus(s, 'diffusion').counts.queued, 1);
  assert.equal(squadronStatus(s, 'studio').counts.queued, 0);
  assert.throws(() => enqueueMission(s, { ...m, kind: 'other' }), /conflicting/);
});
test('completion requires evidence and authorized worker', () => {
  const s = enqueueMission(undefined, m);
  assert.throws(() => transitionMission(s, 'm1', 'running', { agentId: 'video' }), /unauthorized/);
  const running = transitionMission(s, 'm1', 'running', { agentId: 'copy' });
  assert.throws(() => transitionMission(running, 'm1', 'completed'), /evidence/);
  const done = transitionMission(running, 'm1', 'completed', { evidenceId: 'verified-artifact-1' });
  assert.equal(squadronStatus(done, 'diffusion').counts.completed, 1);
  assert.throws(() => transitionMission(done, 'm1', 'running', { agentId: 'copy' }), /invalid-transition/);
});
test('blocked work can be retried, never silently completed', () => {
  const s = enqueueMission(undefined, m);
  const blocked = transitionMission(s, 'm1', 'blocked', { reason: 'provider unavailable' });
  assert.throws(() => transitionMission(blocked, 'm1', 'completed', { evidenceId: 'fake' }), /invalid-transition/);
  assert.equal(transitionMission(blocked, 'm1', 'queued').missions[0].status, 'queued');
});
