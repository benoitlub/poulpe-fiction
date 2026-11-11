import { enqueueMission, transitionMission, squadronStatus } from './ploustroid-squadrons.mjs';
// Passive adapter: a verified delivery observation is the only source of a
// diffusion mission. It never starts a worker or performs delivery.
export function observeDiffusionMission(previous, evidence) {
  const state = previous?.missions ? previous : { missions: [] };
  const parcelId = evidence?.parcelId;
  const cycleId = evidence?.cycleId;
  if (evidence?.status !== 'observed' || !parcelId || !cycleId) {
    return { state, summary: { status: 'insufficient-evidence', ...squadronStatus(state, 'diffusion') } };
  }
  const id = 'diffusion:' + parcelId + ':' + cycleId;
  const existing = state.missions.find(m => m.id === id);
  if (existing) return { state, summary: { status: 'already-observed', ...squadronStatus(state, 'diffusion') } };
  let next = enqueueMission(state, {
    id, parcelId, squadronId: 'diffusion', kind: 'delivery-observation',
    createdAt: evidence.updatedAt ?? new Date().toISOString(),
  });
  next = transitionMission(next, id, 'running', { agentId: 'transport' });
  const action = evidence.advice?.action;
  if (action === 'diagnose-transport') {
    next = transitionMission(next, id, 'blocked', { reason: 'transport-needs-diagnosis' });
  } else if (['await-attributed-metrics', 'review-verified-metrics'].includes(action) &&
             evidence.advice?.evidenceIds?.length) {
    next = transitionMission(next, id, 'completed', { evidenceId: evidence.advice.evidenceIds[0] });
  } else {
    next = transitionMission(next, id, 'blocked', { reason: 'delivery-evidence-incomplete' });
  }
  return { state: next, summary: { status: 'observed', ...squadronStatus(next, 'diffusion') } };
}
