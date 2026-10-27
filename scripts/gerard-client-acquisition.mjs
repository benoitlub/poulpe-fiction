// Pure reusable client-acquisition configuration and evidence gate.
// No personal data is transferred, no message is sent, and no candidate is a hot lead by score alone.
export function getAcquisitionConfig(seed) {
  const entry = seed?.templates?.find(t => t.id === 'client-acquisition' && t.enabled !== false);
  if (!entry || !seed.parcelId || !seed.knowledgeSlug) return null;
  const config = entry.config ?? {};
  if (!config.clientId || !config.offer || !Array.isArray(config.targetSectors) || !config.targetSectors.length) return null;
  return { ...config, parcelId: seed.parcelId, knowledgeSlug: seed.knowledgeSlug, automaticOutreach: false };
}

export function assessAcquisitionCandidate(source, config) {
  const evidence = [source.title, source.snippet, source.evidence].filter(Boolean).join(' ').toLowerCase();
  const terms = [...(config.targetSectors || []), ...(config.keywords || [])]
    .flatMap(value => String(value).toLowerCase().split(/[,;/]/).map(s => s.trim())).filter(s => s.length >= 3);
  const fit = terms.some(term => evidence.includes(term));
  const verified = source.verification === 'page-read';
  // A search snippet is not evidence of budget, timing, a decision maker, or willingness to buy.
  const scores = { need: 0, offerFit: verified && fit ? 25 : 0, budgetEvidence: 0, contactEvidence: 0, timing: 0 };
  const score = Object.values(scores).reduce((a, b) => a + b, 0);
  return { ...source, clientId: config.clientId, parcelId: config.parcelId,
    offer: config.offer, acquisitionScore: score, acquisitionSignals: scores,
    leadStage: verified && fit ? 'investigate-contact' : 'research-only',
    hotLead: false, contacted: false, conversionEvidence: null,
    qualificationReason: verified ? (fit ? 'sector-fit-only; contact, need, budget and timing not verified' : 'no-sector-fit-evidence') : 'source-unverified' };
}

export function formatAcquisitionReview(sources, config) {
  return `# Prospection — ${config.clientId}\n\nMission : ${config.offer}. Sources publiques examinées, aucune prise de contact ni revenu confirmé.\n\n` +
    sources.map((source, i) => `${i + 1}. ${source.title || 'Sans titre'}\n` +
      `   URL : ${source.url}\n   Statut : ${source.leadStage}; score probant ${source.acquisitionScore}/100\n` +
      `   Éléments : ${source.evidence || source.snippet || 'aucun'}\n` +
      `   À vérifier : besoin réel, décideur et canal professionnel public, budget, échéance.\n`).join('\n');
}
