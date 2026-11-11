// Prototype pur : aucune E/S, aucun effet sur les publications.
const validKinds = new Set(['decision', 'delivery', 'metrics']);
export function recordEvent(state = { events: [] }, event) {
  if (!event || !event.eventId || !event.cycleId || !event.parcelId ||
      !validKinds.has(event.kind) || !event.at || !event.payload ||
      typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new TypeError('Invalid learning event');
  }
  const events = Array.isArray(state.events) ? state.events : [];
  const existing = events.find(item => item.eventId === event.eventId);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(event)) throw new Error('Conflicting eventId');
    return { ...state, events };
  }
  return { ...state, events: [...events, structuredClone(event)] };
}
export function adviseNextDecision(state, parcelId) {
  if (!parcelId) throw new TypeError('parcelId required');
  const events = (state?.events ?? []).filter(e => e.parcelId === parcelId);
  const deliveries = events.filter(e => e.kind === 'delivery');
  const latest = deliveries.at(-1);
  if (!latest) return { action: 'proceed-with-existing-policy', evidenceIds: [], reason: 'No delivery observation' };
  const status = latest.payload.status;
  if (['blocked', 'failed', 'error', 'rejected'].includes(status)) {
    return { action: 'diagnose-transport', evidenceIds: [latest.eventId], reason: 'Last delivery failed; do not assume publication' };
  }
  if (['queued', 'sent', 'published', 'confirmed-published'].includes(status)) {
    const measured = events.some(e => e.kind === 'metrics' &&
      e.payload.deliveryEventId === latest.eventId && e.payload.verified === true);
    return measured
      ? { action: 'review-verified-metrics', evidenceIds: [latest.eventId], reason: 'Verified attributed metrics available; no automatic performance claim' }
      : { action: 'await-attributed-metrics', evidenceIds: [latest.eventId], reason: 'Transport status is not evidence of audience response' };
  }
  return { action: 'verify-delivery', evidenceIds: [latest.eventId], reason: 'Delivery outcome unverified' };
}
