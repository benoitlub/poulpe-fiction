/**
 * Owner-reviewed creative feedback is separate from metrics and delivery.
 * This ingests only records committed to GitHub by the owner/review workflow.
 * Browser-local chat text must never be passed here directly.
 */
const clean = (value, limit = 500) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const OWNER = 'benoitlub';
const MAX = 50;

export function integrateOwnerFeedback(previous, inbox, now = new Date().toISOString()) {
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  const received = Array.isArray(inbox?.feedback) ? inbox.feedback : [];
  const existing = Array.isArray(old.ownerFeedback) ? old.ownerFeedback : [];
  const byId = new Map(existing.filter(item => item && typeof item.id === 'string').map(item => [item.id, item]));
  let added = 0;

  for (const item of received) {
    if (!item || item.ownerGitHub !== OWNER || item.source !== 'owner-reviewed-github' ||
        item.status !== 'accepted-for-learning' || !clean(item.id, 120) ||
        !clean(item.parcelId, 100) || !Array.isArray(item.creativeGuidance)) continue;
    const id = clean(item.id, 120);
    if (byId.has(id)) continue;
    const guidance = item.creativeGuidance.map(value => clean(value, 240)).filter(Boolean).slice(0, 8);
    if (!guidance.length) continue;
    byId.set(id, {
      id, source: item.source, ownerGitHub: OWNER,
      approvedAt: clean(item.approvedAt, 40) || null,
      observedAt: now, parcelId: clean(item.parcelId, 100),
      assetType: clean(item.assetType, 80) || null,
      artifact: clean(item.artifact, 350) || null,
      evaluation: {
        voice: clean(item.evaluation?.voice, 80) || null,
        motion: clean(item.evaluation?.motion, 80) || null,
        summary: clean(item.evaluation?.summary, 500) || null,
      },
      creativeGuidance: guidance,
      prohibitedActions: Array.isArray(item.prohibitedActions)
        ? item.prohibitedActions.map(value => clean(value, 180)).filter(Boolean).slice(0, 8) : [],
      status: 'accepted-for-learning',
    });
    added++;
  }

  const ownerFeedback = [...byId.values()].slice(-MAX);
  // Experiments and provider metrics remain independent; advice is explicitly
  // contextual, never a publication authorization or a claim of audience impact.
  const guidance = {
    ...(old.guidance ?? {}),
    ownerCreativeFeedback: ownerFeedback.map(item => ({
      feedbackId: item.id, parcelId: item.parcelId, assetType: item.assetType,
      creativeGuidance: item.creativeGuidance,
      prohibitedActions: item.prohibitedActions,
    })),
  };
  return { ...old, ownerFeedback, guidance, updatedAt: added ? now : old.updatedAt };
}
