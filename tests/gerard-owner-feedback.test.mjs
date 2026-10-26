import test from 'node:test';
import assert from 'node:assert/strict';
import { integrateOwnerFeedback } from '../scripts/gerard-owner-feedback.mjs';

const example = {
  id: 'benoit-420-short', source: 'owner-reviewed-github', ownerGitHub: 'benoitlub',
  status: 'accepted-for-learning', parcelId: '420-dice', assetType: 'short-video',
  creativeGuidance: ['Add animated dice', 'Keep Piper narration'],
  prohibitedActions: ['Do not publish'],
};

test('records reviewed owner feedback once, preserves existing learning', () => {
  const old = { memories: ['old-memory'], guidance: { editorialConstraint: 'rest' }, observations: [{ kind: 'old' }] };
  const learned = integrateOwnerFeedback(old, { feedback: [example] }, '2026-10-26T20:00:00Z');
  assert.equal(learned.ownerFeedback.length, 1);
  assert.equal(learned.guidance.ownerCreativeFeedback[0].parcelId, '420-dice');
  assert.deepEqual(learned.guidance.ownerCreativeFeedback[0].creativeGuidance, example.creativeGuidance);
  assert.deepEqual(learned.observations, old.observations);
  assert.deepEqual(learned.memories, old.memories);
  assert.equal(learned.guidance.editorialConstraint, 'rest');
  const again = integrateOwnerFeedback(learned, { feedback: [example] }, '2026-10-26T21:00:00Z');
  assert.equal(again.ownerFeedback.length, 1);
  assert.equal(again.ownerFeedback[0].observedAt, '2026-10-26T20:00:00Z');
});

test('rejects unreviewed or differently owned messages', () => {
  const invalid = [
    { ...example, id: 'stranger', ownerGitHub: 'anonymous' },
    { ...example, id: 'browser', source: 'browser-local-chat' },
    { ...example, id: 'draft', status: 'pending' },
    { ...example, id: 'empty', creativeGuidance: [' '] },
  ];
  const learned = integrateOwnerFeedback({}, { feedback: invalid });
  assert.equal(learned.ownerFeedback.length, 0);
  assert.deepEqual(learned.guidance.ownerCreativeFeedback, []);
});

test('does not interpret a creative review as a publishing command', () => {
  const learned = integrateOwnerFeedback({}, { feedback: [example] });
  assert.equal(learned.ownerFeedback[0].status, 'accepted-for-learning');
  assert.deepEqual(learned.ownerFeedback[0].prohibitedActions, ['Do not publish']);
  assert.equal(learned.pendingExperiments, undefined);
});
