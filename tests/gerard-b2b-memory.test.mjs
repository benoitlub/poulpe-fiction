import test from 'node:test';
import assert from 'node:assert/strict';
import { businessSourceKey, planBusinessResearch, rememberBusinessResearch } from '../scripts/gerard-b2b-memory.mjs';

const now = new Date('2026-10-25T15:00:00.000Z');
const source = { url: 'https://example.org/partenaires', title: 'Exemple', verification: 'page-read',
  qualification: 'priority-review', fitScore: 90, signals: ['univers-jeux'], evidence: 'Distributeur de jeux',
  nextAction: 'Vérifier les conditions', contacted: false };

test('remembers the first examination and reuses it without another visit', () => {
  const first = rememberBusinessResearch({}, [source], now);
  assert.equal(first.changed.length, 1);
  const plan = planBusinessResearch([source], first.memory, new Date(now.getTime() + 86_400_000));
  assert.equal(plan.fresh.length, 0);
  assert.equal(plan.reused.length, 1);
  assert.equal(plan.reused[0].qualification, 'priority-review');
  assert.equal(rememberBusinessResearch(first.memory, [source], now).changed.length, 0);
});

test('retries stale and never-verified sources instead of treating failures as qualified', () => {
  const first = rememberBusinessResearch({}, [source], now);
  assert.equal(planBusinessResearch([source], first.memory, new Date(now.getTime() + 8 * 86_400_000)).fresh.length, 1);
  const failed = { ...source, verification: 'unverified', fitScore: null };
  const retry = rememberBusinessResearch({}, [failed], now);
  assert.equal(planBusinessResearch([source], retry.memory, now).fresh.length, 1);
});

test('a substantive reassessment is counted, duplicate URL variants normalize and memory stays bounded', () => {
  const first = rememberBusinessResearch({}, [source], now);
  assert.equal(businessSourceKey('https://example.org/partenaires/'), businessSourceKey(source.url));
  const second = rememberBusinessResearch(first.memory, [{ ...source, fitScore: 35 }], now);
  assert.equal(second.changed.length, 1);
  const lots = Array.from({ length: 160 }, (_, i) => ({ ...source, url: `https://example.org/${i}` }));
  assert.equal(Object.keys(rememberBusinessResearch({}, lots, now).memory).length, 150);
});
