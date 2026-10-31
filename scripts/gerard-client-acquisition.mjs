// Pure reusable client-acquisition configuration and evidence gate.
// No personal data is transferred, no message is sent, and no candidate is a hot lead by score alone.

const DEFAULT_SQUADS = Object.freeze([
  { id: 'market', label: 'Squad Marché', objective: 'Cartographier des organisations réelles et sourcées.' },
]);

export function getAcquisitionConfig(seed) {
  const entry = seed?.templates?.find(t => t.id === 'client-acquisition' && t.enabled !== false);
  if (!entry || !seed.parcelId || !seed.knowledgeSlug) return null;
  const config = entry.config ?? {};
  if (!config.clientId || !config.offer || !Array.isArray(config.targetSectors) || !config.targetSectors.length) return null;
  return { ...config, parcelId: seed.parcelId, knowledgeSlug: seed.knowledgeSlug, automaticOutreach: false };
}

export function getAcquisitionSquads(config) {
  const squads = Array.isArray(config?.squads) ? config.squads : [];
  const accepted = squads.filter(squad => squad && typeof squad.id === 'string' && typeof squad.label === 'string')
    .map(squad => ({ id: squad.id.slice(0, 80), label: squad.label.slice(0, 120),
      objective: String(squad.objective ?? '').slice(0, 300) }));
  return accepted.length ? accepted : [...DEFAULT_SQUADS];
}

export function assessAcquisitionCandidate(source, config) {
  const evidence = [source.title, source.snippet, source.evidence].filter(Boolean).join(' ').toLowerCase();
  const terms = [...(config.targetSectors || []), ...(config.keywords || [])]
    .flatMap(value => String(value).toLowerCase().split(/[,;/]/).map(s => s.trim())).filter(s => s.length >= 3);
  const fit = terms.some(term => evidence.includes(term));
  const verified = source.verification === 'page-read';
  const scores = { need: 0, offerFit: verified && fit ? 25 : 0, budgetEvidence: 0, contactEvidence: 0, timing: 0 };
  const score = Object.values(scores).reduce((a, b) => a + b, 0);
  return { ...source, clientId: config.clientId, parcelId: config.parcelId,
    offer: config.offer, acquisitionScore: score, acquisitionSignals: scores,
    leadStage: verified && fit ? 'investigate-contact' : 'research-only',
    hotLead: false, contacted: false, conversionEvidence: null,
    qualificationReason: verified ? (fit ? 'sector-fit-only; contact, need, budget and timing not verified' : 'no-sector-fit-evidence') : 'source-unverified' };
}

export function buildAcquisitionPulse(sources, config) {
  const rows = Array.isArray(sources) ? sources : [];
  const priority = rows.filter(source => source?.leadStage === 'investigate-contact')
    .sort((a, b) => (b.acquisitionScore ?? 0) - (a.acquisitionScore ?? 0)).slice(0, 3);
  const first = priority[0] ?? null;
  return {
    contract: 'market->priority->next-action',
    observed: rows.length,
    priorityCount: priority.length,
    priority: priority.map(source => ({ title: source.title || 'Sans titre', url: source.url || null, score: source.acquisitionScore ?? 0, stage: source.leadStage })),
    nextAction: first
      ? `Vérifier le décideur, le canal professionnel public, le besoin, le budget et l'échéance pour ${first.title || 'la cible prioritaire'}.`
      : 'Chercher ou lire une source publique supplémentaire avant de proposer une prise de contact.',
    squads: getAcquisitionSquads(config),
    automaticOutreach: false,
  };
}

export function formatAcquisitionReview(sources, config) {
  const pulse = buildAcquisitionPulse(sources, config);
  const squadLine = pulse.squads.map(squad => squad.label).join(' · ');
  const priorityLine = pulse.priority.length
    ? pulse.priority.map((source, i) => `${i + 1}. ${source.title} (${source.score}/100)`).join(' | ')
    : 'aucune cible suffisamment vérifiée';
  return `# Prospection — ${config.clientId}\n\n` +
    `Squads : ${squadLine}\n` +
    `Contrat de sortie : ${pulse.observed} sources observées → ${pulse.priorityCount} à approfondir → 1 prochaine action.\n` +
    `Priorité : ${priorityLine}\n` +
    `Prochaine action : ${pulse.nextAction}\n\n` +
    `Mission : ${config.offer}. Sources publiques examinées, aucune prise de contact ni revenu confirmé.\n\n` +
    sources.map((source, i) => `${i + 1}. ${source.title || 'Sans titre'}\n` +
      `   URL : ${source.url}\n   Statut : ${source.leadStage}; score probant ${source.acquisitionScore}/100\n` +
      `   Éléments : ${source.evidence || source.snippet || 'aucun'}\n` +
      `   À vérifier : besoin réel, décideur et canal professionnel public, budget, échéance.\n`).join('\n');
}

export async function handoffAcquisitionReviews(sources, config, { publisherUrl, token, fetcher = fetch } = {}) {
  if (!token || !publisherUrl) return { status: 'disabled', attempted: 0, created: 0 };
  const eligible = sources.filter(source => source.verification === 'page-read' &&
    source.leadStage === 'investigate-contact' && source.url && source.evidence).slice(0, 5);
  let created = 0;
  let failed = 0;
  for (const source of eligible) {
    try {
      const response = await fetcher(`${publisherUrl.replace(/\/$/, '')}/api/client-acquisition/notion/review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: config.clientId, organization: source.title, sourceUrl: source.url, evidence: source.evidence, observedAt: new Date().toISOString().slice(0, 10) }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json();
      if (response.ok && payload.status === 'created-for-review') created++;
      else if (!response.ok) failed++;
    } catch { failed++; }
  }
  return { status: failed ? 'partial' : 'completed', attempted: eligible.length, created, failed };
}
