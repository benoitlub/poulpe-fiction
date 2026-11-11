/** Read-only diagnosis: no external writes or inferred publication success. */
const str = x => typeof x === 'string' && x.trim().length > 0;
export function diagnosePublication(candidate = {}, { bufferTokenPresent = false } = {}) {
  const issues = [];
  const add = (code, owner, action) => issues.push({ code, owner, action });
  if (!str(candidate.harvestId)) add('MISSING_HARVEST', 'selection', 'Select a traceable harvest.');
  if (candidate.status !== 'ready') add('CANDIDATE_NOT_READY', 'selection', 'Complete selection before transport.');
  if (!str(candidate.copy?.text)) add('MISSING_COPY', 'creative', 'Prepare a nonempty caption.');
  const provider = candidate.transport?.provider;
  if (!['buffer', 'metricool'].includes(provider)) add('NO_SUPPORTED_PROVIDER', 'routing', 'Choose an explicit supported destination.');
  if (provider === 'buffer') {
    if (!str(candidate.transport?.channelId)) add('BUFFER_CHANNEL_MISSING', 'routing', 'Configure the target channel.');
    if (!str(candidate.media?.url) || !candidate.media.url.startsWith('https://')) add('BUFFER_MEDIA_MISSING', 'creative', 'Provide a publicly accessible HTTPS image.');
    if (!bufferTokenPresent) add('BUFFER_TOKEN_MISSING', 'credentials', 'Check BUFFER_DRAFT_WRITE_TOKEN secret.');
    if (candidate.bufferPreflight?.status !== 'ready-for-controlled-test') add('BUFFER_PREFLIGHT_NOT_READY', 'transport', 'Inspect Buffer preflight.');
    if (candidate.action !== 'hold-for-buffer-draft') add('BUFFER_ACTION_NOT_ELIGIBLE', 'selection', 'Inspect the selected action.');
  }
  if (provider === 'metricool') {
    if (candidate.editorialRoute?.destination?.preferredProvider !== 'metricool') add('METRICOOL_ROUTE_MISMATCH', 'routing', 'Align the editorial destination.');
    if (!Array.isArray(candidate.compatibleNetworks) || !candidate.compatibleNetworks.length) add('METRICOOL_NETWORK_MISSING', 'routing', 'Select compatible networks.');
    if (!str(candidate.seedId)) add('METRICOOL_SEED_MISSING', 'selection', 'Associate the harvest with a seed.');
    if (candidate.metricoolHandoff?.status === 'mail-sent') add('METRICOOL_PROVIDER_UNCONFIRMED', 'relay', 'Verify provider post ID and scheduled/published status.');
    if (['mail-unconfirmed','mail-already-reserved'].includes(candidate.metricoolHandoff?.status)) add('METRICOOL_RELAY_UNCONFIRMED', 'relay', 'Inspect Gmail relay and downstream automation; do not resend blindly.');
  }
  return { harvestId: candidate.harvestId ?? null, provider: provider ?? null,
    state: issues.length ? 'blocked-or-unconfirmed' : 'eligible-for-provider-check',
    issues, publicationConfirmed: ['confirmed-scheduled','confirmed-published'].includes(candidate.delivery?.status)
      && str(candidate.delivery?.postId) };
}
export function analyticsHealth(advice = {}, feedback = {}, now = new Date()) {
  const checkedAt = feedback.snapshotCheckedAt;
  const age = checkedAt ? now.getTime() - Date.parse(checkedAt) : NaN;
  return { publisher: advice.status === 'unavailable' ? 'unavailable' : 'response-recorded',
    providerMetrics: Number.isFinite(age) && age >= 0 && age <= 48 * 3600 * 1000 ? 'recent' : 'stale-or-unavailable',
    checkedAt: checkedAt ?? null, actionable: 'Refresh verified attributed per-post measurements; never infer performance from historical snapshots.' };
}
