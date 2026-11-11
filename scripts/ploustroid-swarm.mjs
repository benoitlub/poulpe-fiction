/** Bounded, event-driven Gégé swarm. No publishing or external side effects. */
export const ROLES = Object.freeze(['copy-review', 'visual-review', 'delivery-readiness']);
const clean = v => typeof v === 'string' && v.trim().length > 0;
export function makeMission({ id, parcelId, copyText, visual, delivery }) {
  if (!clean(id) || !clean(parcelId)) throw new TypeError('mission-id-and-parcel-required');
  return { id, parcelId, copyText: copyText ?? null, visual: visual ?? null,
    delivery: delivery ?? null, roles: [...ROLES] };
}
const workers = {
  'copy-review': m => ({ ready: clean(m.copyText), evidence: clean(m.copyText) ? 'copy-present' : 'copy-missing' }),
  'visual-review': m => ({ ready: Boolean(m.visual && (clean(m.visual.fileId) || clean(m.visual.url))), evidence: m.visual ? 'visual-reference-checked' : 'visual-missing' }),
  'delivery-readiness': m => ({ ready: Boolean(m.delivery && clean(m.delivery.provider) && clean(m.delivery.target)), evidence: m.delivery ? 'delivery-target-checked' : 'delivery-target-missing' }),
};
export async function runSwarm(mission, { concurrency = 3 } = {}) {
  if (!mission || !clean(mission.id) || !clean(mission.parcelId) ||
      !Array.isArray(mission.roles) || mission.roles.some(r => !ROLES.includes(r)))
    throw new TypeError('invalid-mission');
  const roles = [...new Set(mission.roles)];
  const width = Math.max(1, Math.min(3, Math.floor(concurrency) || 1));
  const results = [];
  for (let i = 0; i < roles.length; i += width) {
    const batch = await Promise.allSettled(roles.slice(i, i + width).map(async role => ({
      role, ...workers[role](mission),
    })));
    results.push(...batch.map((r, j) => r.status === 'fulfilled' ? r.value :
      { role: roles[i + j], ready: false, evidence: 'worker-error' }));
  }
  const ready = results.length === 3 && results.every(r => r.ready);
  return { missionId: mission.id, parcelId: mission.parcelId,
    status: ready ? 'ready-for-existing-review' : 'blocked', results,
    publicationAttempted: false };
}
