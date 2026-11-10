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
        body: JSON.stringify({ clientId: config.clientId, organization: source.title,
          sourceUrl: source.url, evidence: source.evidence, observedAt: new Date().toISOString().slice(0, 10) }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json();
      if (response.ok && payload.status === 'created-for-review') created++;
      else if (!response.ok) failed++;
    } catch { failed++; }
  }
  return { status: failed ? 'partial' : 'completed', attempted: eligible.length, created, failed };
}

/** Assemble reviewed prospect dossiers in the existing outbox; never send. */
export function acquisitionDossiers(sources, config, previous = [], now = new Date(), learning = {}) {
  const targets = (config.targets ?? []).slice(0, 3);
  return targets.map(target => {
    const id = `${config.clientId}:${config.parcelId}:${new URL(target.url).hostname}`;
    const old = previous.find(item => item.id === id && item.parcelId === config.parcelId);
    const past = learning?.guidance?.acquisitionOutcomes?.[id];
    if (past?.clientId === config.clientId && past.parcelId === config.parcelId && past.outcome === 'refused')
      return {...(old ?? {id,clientId:config.clientId,parcelId:config.parcelId,organization:target.organization}), ...past, status:'refused'};
    const source = sources.find(item => item.url === target.url && item.verification === 'page-read');
    // A sent/replied/refused record is historical evidence, never a fresh draft.
    if (old && (old.sentAt || old.contacted || ['sending', 'unknown', 'sent', 'reply', 'refused', 'agreement'].includes(old.status))) return {...old,...acquisitionNextAction(old,now)};
    if (old?.response?.verified === true) return {...old,...acquisitionNextAction(old,now)};
    if (old?.status === 'human-approved') return old;
    const products = (config.products ?? []).map(name => ({ name, verifiedFacts: ['Nom fourni par Benoît'], missing: ['règles', 'joueurs/âge/durée', 'état du prototype', 'droits', 'conditions commerciales'] }));
    const body = `Bonjour,\n\nJe suis Gérard, assistant numérique de Benoît Lubert. Nous souhaitons vérifier la possibilité de vous présenter Pro.Hibited, Prout.Hibited et Jointed pour une éventuelle édition ou distribution.\n\n${target.approach}\n\nAcceptez-vous actuellement des propositions de jeux et, si oui, quelle procédure et quels éléments souhaitez-vous recevoir ? Après validation de Benoît et finalisation des fiches, nous pourrons convenir d'une présentation ou démonstration.\n\nMerci,\nGérard, pour Benoît Lubert`;
    return { id, parcelId: config.parcelId, clientId: config.clientId, brandId: 'pro-hibited',
      organization: target.organization, sourceUrl: target.url, channelUrl: target.url,
      recipientEmail: source?.contactEmail && !/^(sav|support|noreply|no-reply)@/i.test(source.contactEmail) ? source.contactEmail : null, organizationVerified: Boolean(source),
      sourceEvidence: source?.evidence ?? null, checkedAt: source?.examinedAt ?? now.toISOString(),
      dossierCompleteness: 'product-facts-incomplete', reviewScope: 'Validation d’une demande de procédure ; pas une offre commerciale complète.',
      submissionPolicy: 'requires-confirmation', productSheets: products,
      hypothesis: target.approach, subject: `Proposition de présentation de jeux — ${target.organization}`,
      body, status: source ? 'awaiting-human-approval' : 'research-only',
      pipelineStage: source ? 'prêt à valider' : 'à vérifier',
      nextAction: old?.nextAction ?? { dueAt: new Date(now.getTime() + 86400000).toISOString(), action: source ? 'Benoît : relire le dossier, compléter les fiches puis valider le canal et le message exact.' : 'Vérifier le canal officiel avant toute demande de contact.' },
      missing: ['acceptation actuelle des soumissions', ...products.flatMap(p => p.missing.map(f => `${p.name}: ${f}`))],
      sentAt: null, contacted: false, response: null, followUp: 'Aucune relance avant envoi autorisé et vérifié.',
      outcome: 'insufficient-data', lesson: 'Un dossier ou un canal public ne prouve ni intérêt commercial, ni vente.' };
  });
}

export function acquisitionNextAction(draft, now = new Date()) {
  const response = draft.response;
  const verified = response?.verified === true && typeof response.evidenceUrl === 'string' && /^https:\/\//.test(response.evidenceUrl);
  if (verified && ['refused','interested','agreement'].includes(response.outcome)) {
    const outcome=response.outcome;
    return { outcome, pipelineStage: outcome === 'refused' ? 'refus' : outcome === 'agreement' ? 'accord' : 'réponse',
      nextAction: {dueAt:now.toISOString(),action:outcome === 'refused' ? 'Ne pas relancer cette proposition ; revoir l’adéquation avant toute nouvelle approche.' : 'Benoît : examiner la réponse et valider la suite avant tout envoi ou engagement.'},
      lesson: outcome === 'refused' ? 'Le destinataire a refusé cette proposition : ne pas réutiliser le même contact comme une nouvelle piste.' : 'Une réponse vérifiée justifie une revue humaine ; aucun revenu ne peut être déduit.' };
  }
  if (draft.sentAt && draft.contacted) return {outcome:'awaiting-response',pipelineStage:'envoyé',
    nextAction:{dueAt:new Date(Date.parse(draft.sentAt)+7*86400000).toISOString(),action:'Vérifier une éventuelle réponse ; préparer une relance uniquement après validation humaine.'},
    lesson:'Envoi déclaré par le transport, pas de réponse ou de vente démontrée.'};
  return {outcome:'insufficient-data',pipelineStage:draft.organizationVerified ? 'prêt à valider':'à vérifier',nextAction:draft.nextAction,
    lesson:'Un dossier préparé ne prouve ni contact effectué ni intérêt commercial.'};
}

export function integrateAcquisitionFeedback(learning, outbox, now = new Date()) {
  const drafts=(outbox?.drafts ?? []).filter(d=>d.clientId && d.parcelId);
  const outcomes=Object.fromEntries(drafts.map(d=>[d.id,{clientId:d.clientId,parcelId:d.parcelId,...acquisitionNextAction(d,now)}]));
  return {...learning,guidance:{...(learning.guidance ?? {}),acquisitionOutcomes:{...(learning.guidance?.acquisitionOutcomes ?? {}),...outcomes}}};
}
