/**
 * The runtime's local Express Publisher adapter does not expose
 * business.sources.search. The deployed Publisher Worker does.
 * Only this read-only lookup goes directly to the Worker; all other Gérard
 * missions continue through the locally registered Octopus adapter.
 */
export function parseBusinessSourceResponse(response) {
  const payload = response?.payload ?? {};
  const output = payload?.output ?? {};
  const valid = response?.status === 'ok' && payload?.status === 'completed' &&
    output?.capability === 'business.sources.search';
  if (!valid) return {
    status: 'unavailable', candidates: [],
    reason: String(payload?.summary ?? response?.message ?? payload?.status ?? 'adapter-unavailable').slice(0, 180),
  };
  const candidates = Array.isArray(output.candidates) ? output.candidates : [];
  const seen = new Set();
  const accepted = candidates.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.url !== 'string') return [];
    let url;
    try { url = new URL(item.url); } catch { return []; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
    if (url.username || url.password || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return [];
    const key = url.origin + url.pathname.replace(/\/$/, '');
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ title: String(item.title ?? 'Sans titre').slice(0, 200), url: url.href,
      snippet: String(item.snippet ?? '').slice(0, 500), verification: 'search-result-only' }];
  }).slice(0, 10);
  return { status: accepted.length ? 'sources-found' : 'no-sources', candidates: accepted, reason: null };
}

export async function searchBusinessSources({ publisherUrl, operationId, seed, call }) {
  const mission = {
    operationId: `${operationId}-business-sources`,
    title: 'Recherche de distributeurs et partenaires B2B',
    objective: seed.objective,
    prompt: 'Distributeurs grossistes jeux de cartes accessoires cannabis légal, partenaires événements, coédition jeux, acheteurs B2B Europe ; sources professionnelles officielles et pages contact',
    requiredCapabilities: ['business.sources.search'], authorizedResources: [],
    context: { id: seed.parcelId, metadata: { seedId: seed.seedId, source: 'gerard-cycle' } },
  };
  const response = await call(`${publisherUrl}/api/octopus-adapter/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract: 'octopus-adapter-execution-v1', adapterId: 'publisher', mission }),
  });
  return parseBusinessSourceResponse(response);
}
