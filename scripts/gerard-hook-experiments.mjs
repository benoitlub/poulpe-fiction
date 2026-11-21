/** Editorial hypotheses are advisory; never infer algorithmic guarantees. */
const clean = x => typeof x === 'string' && x.trim().length > 0;
export function planHookExperiment(decision = {}, previous = {}) {
  const identity = decision.harvestId ?? decision.seedId ?? decision.parcelId;
  if (!clean(String(identity ?? ''))) return { status: 'no-identifiable-parcel' };
  const text = decision.copyText ?? '';
  const firstLine = text.split(/\n/).map(s => s.trim()).find(Boolean) ?? '';
  const hook = firstLine.slice(0, 180);
  const angle = /\?/.test(hook) ? 'curiosity-question' :
    /\b(comment|pourquoi|how|why|imagine|si)\b/i.test(hook) ? 'curiosity-promise' : 'direct-statement';
  const key = String(identity) + '|hook|' + angle;
  const known = (previous.hookExperiments ?? []).find(x => x.key === key);
  return {
    status: clean(hook) ? 'hypothesis-prepared' : 'missing-copy',
    key, parcelId: String(identity), hook, angle,
    hypothesis: angle === 'curiosity-question'
      ? 'A self-contained question may encourage non-followers to continue watching.'
      : 'A clear opening may help non-followers understand the content quickly.',
    metrics: ['reach', 'averageWatchTime', 'shares', 'saves', 'profileVisits'],
    assessment: 'awaiting-attributed-provider-metrics',
    previouslyRecorded: Boolean(known),
    disclaimer: 'No guaranteed reach; compare only verified metrics on comparable posts.',
  };
}
export function recordHookExperiment(state = {}, experiment) {
  if (experiment.status !== 'hypothesis-prepared') return state;
  const entries = Array.isArray(state.hookExperiments) ? state.hookExperiments : [];
  if (entries.some(x => x.key === experiment.key)) return state;
  return { ...state, hookExperiments: [...entries, experiment].slice(-50) };
}
