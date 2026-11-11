import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMission, runSwarm } from '../scripts/ploustroid-swarm.mjs';
test('runs three specialist checks and returns verified readiness', async () => {
  const mission = makeMission({ id: 'm1', parcelId: 'p1', copyText: 'Bonjour',
    visual: { fileId: 'img1' }, delivery: { provider: 'buffer', target: 'books' } });
  const r = await runSwarm(mission);
  assert.equal(r.status, 'ready-for-existing-review');
  assert.equal(r.results.length, 3);
  assert.equal(r.publicationAttempted, false);
});
test('blocks missing assets without pretending to publish', async () => {
  const r = await runSwarm(makeMission({ id: 'm2', parcelId: 'p2', copyText: 'Bonjour' }), { concurrency: 1 });
  assert.equal(r.status, 'blocked');
  assert.equal(r.results.filter(x => !x.ready).length, 2);
});
test('rejects unknown roles', async () => {
  const m = makeMission({ id: 'm3', parcelId: 'p3' });
  m.roles = ['evil'];
  await assert.rejects(runSwarm(m), /invalid-mission/);
});
