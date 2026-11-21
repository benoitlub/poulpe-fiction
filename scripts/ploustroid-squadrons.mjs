// Pure mission registry. No network, scheduling, publication or external side effects.
export const SQUADRONS = Object.freeze({
  diffusion: Object.freeze({ leader: 'gerard', agents: ['copy', 'visual', 'editor', 'transport'] }),
  commerce: Object.freeze({ leader: 'commerce', agents: ['prospect', 'qualify', 'correspondence'] }),
  studio: Object.freeze({ leader: 'studio', agents: ['script', 'image', 'video'] }),
  intelligence: Object.freeze({ leader: 'publisher', agents: ['research', 'verify', 'memory'] }),
});
const transitions = {
  queued: new Set(['running', 'blocked']),
  running: new Set(['completed', 'blocked', 'failed']),
  blocked: new Set(['queued']),
  failed: new Set(['queued']),
  completed: new Set(),
};
export function enqueueMission(state = { missions: [] }, mission) {
  if (!mission || !mission.id || !mission.parcelId || !mission.kind ||
      !mission.createdAt || !SQUADRONS[mission.squadronId]) throw new TypeError('invalid-mission');
  const missions = state.missions ?? [];
  const previous = missions.find(item => item.id === mission.id);
  if (previous) {
    if (JSON.stringify(previous) !== JSON.stringify({ ...mission, status: 'queued' }))
      throw new Error('conflicting-mission-id');
    return state;
  }
  return { ...state, missions: [...missions, { ...mission, status: 'queued' }] };
}
export function transitionMission(state, id, status, { agentId, evidenceId, reason } = {}) {
  const missions = state?.missions ?? [];
  const index = missions.findIndex(item => item.id === id);
  if (index < 0) throw new Error('unknown-mission');
  const current = missions[index];
  if (!transitions[current.status]?.has(status)) throw new Error('invalid-transition');
  if (status === 'running' && !SQUADRONS[current.squadronId].agents.includes(agentId))
    throw new Error('unauthorized-agent');
  if (status === 'completed' && (!evidenceId || typeof evidenceId !== 'string'))
    throw new Error('completion-requires-evidence');
  if (['blocked', 'failed'].includes(status) && !reason) throw new Error('reason-required');
  const next = { ...current, status, ...(agentId ? { agentId } : {}),
    ...(evidenceId ? { evidenceId } : {}), ...(reason ? { reason } : {}) };
  return { ...state, missions: missions.map((item, i) => i === index ? next : item) };
}
export function squadronStatus(state, squadronId) {
  if (!SQUADRONS[squadronId]) throw new Error('unknown-squadron');
  const missions = (state?.missions ?? []).filter(m => m.squadronId === squadronId);
  return { squadronId, counts: Object.fromEntries(
    ['queued','running','blocked','failed','completed'].map(s => [s, missions.filter(m => m.status === s).length])
  ) };
}
