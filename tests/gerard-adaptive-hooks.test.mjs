import test from 'node:test';
import assert from 'node:assert/strict';
import { recordEvent, adviseNextDecision } from '../scripts/gerard-adaptive-hooks.mjs';
const delivery = { eventId: 'e1', cycleId: 'cycle-1', parcelId: 'benoit', kind: 'delivery', at: '2026-11-11T10:00:00Z', payload: { status: 'blocked' } };
test('two cycles: a failed transport changes next-cycle advice', () => {
  let state = recordEvent({ events: [] }, delivery);
  const next = adviseNextDecision(state, 'benoit');
  assert.equal(next.action, 'diagnose-transport');
  assert.deepEqual(next.evidenceIds, ['e1']);
  state = recordEvent(state, { eventId: 'e2', cycleId: 'cycle-2', parcelId: 'benoit', kind: 'decision', at: '2026-11-11T10:05:00Z', payload: { action: next.action, basedOn: next.evidenceIds } });
  assert.equal(state.events[1].payload.action, 'diagnose-transport');
});
test('parcel isolation and idempotence', () => {
  const state = recordEvent({ events: [] }, delivery);
  assert.equal(recordEvent(state, delivery).events.length, 1);
  assert.equal(adviseNextDecision(state, 'other').action, 'proceed-with-existing-policy');
  assert.throws(() => recordEvent(state, { ...delivery, payload: { status: 'sent' } }), /Conflicting/);
});
test('accepted transport does not imply metrics or publication', () => {
  const sent = { ...delivery, eventId: 'e3', payload: { status: 'queued' } };
  const state = recordEvent({ events: [] }, sent);
  assert.equal(adviseNextDecision(state, 'benoit').action, 'await-attributed-metrics');
});
test('attributed verified metrics are considered, not ranked', () => {
  let state = recordEvent({ events: [] }, { ...delivery, payload: { status: 'sent' } });
  state = recordEvent(state, { eventId: 'e4', cycleId: 'cycle-1', parcelId: 'benoit', kind: 'metrics', at: '2026-11-11T10:10:00Z', payload: { deliveryEventId: 'e1', verified: true, reach: 30 } });
  assert.equal(adviseNextDecision(state, 'benoit').action, 'review-verified-metrics');
});
