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

test('a verified sent receipt creates a pending experiment, not an audience success', () => {
  const delivery = {status:'confirmed-published',postId:'provider-post-1',providerStatus:'sent'};
  const result=integrateLearningCycle({},decision,{delivery},{},{},'2026-11-02T12:00:00Z');
  assert.equal(result.observations.at(-1).outcome,'transport-accepted');
  assert.equal(result.pendingExperiments.length,1);
  assert.equal(result.pendingExperiments[0].assessment,'awaiting-verified-attributed-metrics');
  assert.equal(result.guidance.performanceRankingEnabled,false);
});
test('a publication label alone is not a verified provider receipt', () => {
  for(const delivery of [{status:'confirmed-published'},{status:'confirmed-published',postId:'provider-post-1',providerStatus:'draft'}]) {
    const result=integrateLearningCycle({},decision,{delivery},{},{},'2026-11-02T12:00:00Z');
    assert.equal(result.observations.at(-1).outcome,'not-verified');
    assert.equal(result.pendingExperiments.length,0);
  }
});
test('an authorization block is recorded as a block, never as a poor audience result', () => {
  const result=integrateLearningCycle({},decision,{delivery:{status:'blocked',reason:'TOKEN_MISSING'}},{},{},'2026-11-02T12:00:00Z');
  assert.equal(result.observations.at(-1).outcome,'transport-blocked');
  assert.match(result.guidance.nextExperiment,/Diagnose/);
  assert.equal(result.pendingExperiments.length,0);
  assert.equal(result.guidance.performanceRankingEnabled,false);
});
