import test from 'node:test';
import assert from 'node:assert/strict';
import { integrateLearningCycle } from '../scripts/gerard-learning-cycle.mjs';
import { applyMetricoolFeedback } from '../scripts/gerard-social-feedback.mjs';

const decision = { seedId: 'terra', harvestId: 'h-1', copyText: 'TERRA',
  deliberation: { chosen: { id: 'video-angle', hypothesis: 'Video may reach new readers.' } } };
const publication = { delivery: { status: 'queued', providerPostId: 'p-1' } };

test('keeps earlier learning and tracks a pending experiment without claiming results', () => {
  const old = { memories: ['do not erase'], observations: [{ kind: 'old' }],
    guidance: { editorialConstraint: 'slow down' }, socialFeedback: { status: 'observed' } };
  const result = integrateLearningCycle(old, decision, publication, { status: 'available' }, {}, '2026-10-26T12:00:00Z');
  assert.deepEqual(result.memories, old.memories);
  assert.deepEqual(result.socialFeedback, old.socialFeedback);
  assert.equal(result.guidance.editorialConstraint, 'slow down');
  assert.equal(result.guidance.performanceRankingEnabled, false);
  assert.equal(result.pendingExperiments[0].assessment, 'awaiting-verified-attributed-metrics');
  assert.equal(result.observations.at(-1).outcome, 'transport-accepted');
  const replay = integrateLearningCycle(result, decision, publication, { status: 'available' }, {}, '2026-10-26T13:00:00Z');
  assert.equal(replay.observations.length, result.observations.length);
  assert.equal(replay.pendingExperiments.length, 1);
});

test('only harvest-attributed, verified provider evidence completes an experiment', () => {
  const learned = integrateLearningCycle({}, decision, publication, {}, {}, '2026-10-26T12:00:00Z');
  const base = { status: 'available', source: 'metricool-connected-analytics', posts: [{
    network: 'tiktok', verified: true, text: 'TERRA', url: 'https://tiktok.com/post/1', metrics: { reach: 12 },
  }] };
  const unlinked = applyMetricoolFeedback(learned, base);
  assert.equal(unlinked.learning.pendingExperiments.length, 1);
  const linked = applyMetricoolFeedback(learned, { ...base, posts: [{ ...base.posts[0], harvestId: 'h-1' }] });
  assert.equal(linked.learning.pendingExperiments.length, 0);
  assert.equal(linked.learning.completedExperiments[0].assessment, 'verified-provider-observation');
  assert.equal(linked.learning.guidance.performanceRankingEnabled, false);
});
