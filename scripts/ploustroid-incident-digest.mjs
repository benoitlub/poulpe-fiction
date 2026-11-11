// Pure incident aggregation; no mail, external calls, or side effects.
const allowed = new Set(['recoverable', 'repeated', 'action-required']);
export function ingestIncident(state = { incidents: [] }, event) {
  if (!event || !event.id || !event.fingerprint || !event.at || !allowed.has(event.severity))
    throw new TypeError('invalid-incident');
  const incidents = Array.isArray(state.incidents) ? state.incidents : [];
  if (incidents.some(item => item.ids.includes(event.id))) return state;
  const index = incidents.findIndex(item => item.fingerprint === event.fingerprint && item.status !== 'resolved');
  if (index < 0) return { ...state, incidents: [...incidents, {
    fingerprint: event.fingerprint, status: 'open', severity: event.severity,
    count: 1, firstSeen: event.at, lastSeen: event.at, ids: [event.id],
    notified: false, detail: event.detail ?? null,
  }].slice(-200) };
  const current = incidents[index];
  const severity = current.severity === 'action-required' || event.severity === 'action-required'
    ? 'action-required' : current.count >= 1 || event.severity === 'repeated' ? 'repeated' : 'recoverable';
  return { ...state, incidents: incidents.map((item, i) => i === index ? {
    ...item, count: item.count + 1, lastSeen: event.at, ids: [...item.ids, event.id].slice(-100),
    severity, detail: event.detail ?? item.detail,
  } : item) };
}
export function resolveIncident(state, fingerprint) {
  return { ...state, incidents: (state.incidents ?? []).map(item =>
    item.fingerprint === fingerprint ? { ...item, status: 'resolved' } : item) };
}
export function incidentDigest(state) {
  const open = (state.incidents ?? []).filter(item => item.status === 'open');
  return { recoverable: open.filter(i => i.severity === 'recoverable'),
    repeated: open.filter(i => i.severity === 'repeated'),
    actionRequired: open.filter(i => i.severity === 'action-required' && !i.notified) };
}
export function markNotified(state, fingerprint) {
  return { ...state, incidents: (state.incidents ?? []).map(item =>
    item.fingerprint === fingerprint && item.severity === 'action-required'
      ? { ...item, notified: true } : item) };
}
