import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailDrafts, mergeMailDrafts, GERARD_SENDER_EMAIL } from '../scripts/gerard-mail-outbox.mjs';

const source = { title: 'Maison du jeu', url: 'https://example.org/partenaires',
  verification: 'page-read', qualification: 'priority-review', fitScore: 90, evidence: 'Grossiste jeux B2B' };

test('drafts are honest, unsent and have no invented email addresses', () => {
  const [draft] = createMailDrafts([source]);
  assert.equal(draft.recipientEmail, null);
  assert.equal(draft.senderEmail, GERARD_SENDER_EMAIL);
  assert.equal(draft.senderEmail, 'gerardpoulpefiction@gmail.com');
  assert.equal(draft.contacted, false);
  assert.equal(draft.sentAt, null);
  assert.match(draft.body, /assistant commercial numérique/);
});

test('unverified or weak discoveries never become outreach drafts', () => {
  assert.equal(createMailDrafts([{ ...source, verification: 'unverified' }]).length, 0);
  assert.equal(createMailDrafts([{ ...source, fitScore: 35 }]).length, 0);
});

test('an existing draft and its status are retained on rediscovery', () => {
  const [draft] = createMailDrafts([source]);
  const revised = { ...draft, status: 'human-approved' };
  assert.deepEqual(mergeMailDrafts([revised], [draft]), [revised]);
});

test('existing unsent drafts gain the real sender without changing their reviewed status', () => {
  const [draft] = createMailDrafts([source]);
  const previous = { ...draft, senderEmail: null, status: 'human-approved' };
  assert.deepEqual(mergeMailDrafts([previous], [draft]), [{ ...previous, senderEmail: GERARD_SENDER_EMAIL }]);
  const sent = { ...previous, sentAt: '2026-10-01T00:00:00Z', contacted: true };
  assert.deepEqual(mergeMailDrafts([sent], [draft]), [sent]);
});
