import { readFile, writeFile, mkdir } from 'node:fs/promises';

const TEMPLATE_URL = new URL('../templates/community-radar.v1.json', import.meta.url);
const OUTPUT_URL = new URL('../garden/community-radar.json', import.meta.url);

export function communityRadarConfig(seed, template) {
  const selected = Array.isArray(seed?.templates) ? seed.templates.find(t => t.id === 'community-radar' && t.enabled !== false) : null;
  if (!selected) return null;
  if (!seed.parcelId || !seed.seedId || !seed.knowledgeSlug) throw new Error('invalid-community-seed');
  const c = selected.config || {};
  if (!Array.isArray(c.audience) || !c.audience.length || !c.offer) throw new Error('invalid-community-config');
  return { ...template, parcelId: seed.parcelId, knowledgeSlug: seed.knowledgeSlug,
    audience: c.audience, offer: c.offer, geography: c.geography || [], languages: c.languages || ['fr'],
    channels: c.channels || template.channels };
}

export function communityRadarQueries(config) {
  const tokens = { audience: config.audience.join(' '), offer: config.offer,
    geography: config.geography.join(' ') };
  return config.discovery.queryTemplates.map(s => s.replace(/{{(audience|offer|geography)}}/g, (_, k) => tokens[k]).trim());
}

export function normalizeCommunityCandidates(candidates, config, checkedAt = new Date().toISOString()) {
  const seen = new Set();
  return (Array.isArray(candidates) ? candidates : []).flatMap(c => {
    let url;
    try { url = new URL(c.url); } catch { return []; }
    if (url.protocol !== 'https:' || url.username || url.password) return [];
    const key = url.origin + url.pathname.replace(/\/$/, '');
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ parcelId: config.parcelId, communityName: String(c.title || url.hostname).slice(0, 180),
      url: key, platform: url.hostname, audience: config.audience,
      rulesUrl: null, rulesVerified: false, score: null, status: 'discovered',
      sourceCheckedAt: checkedAt, evidence: String(c.snippet || '').slice(0, 500),
      lastInteractionAt: null, response: null, conversionEvidence: null,
      contacted: false, verifiedLead: false }];
  }).slice(0, config.discovery.maxCandidates || 20);
}

export function mergeCommunityRecords(existing, incoming) {
  const map = new Map();
  for (const c of existing || []) map.set(c.parcelId + '|' + c.url, c);
  for (const c of incoming || []) {
    const key = c.parcelId + '|' + c.url;
    const old = map.get(key);
    map.set(key, old ? { ...c, ...old, sourceCheckedAt: c.sourceCheckedAt,
      evidence: c.evidence || old.evidence } : c);
  }
  return [...map.values()];
}

export async function runCommunityRadar(seed, { search, templateUrl = TEMPLATE_URL, outputUrl = OUTPUT_URL } = {}) {
  const template = JSON.parse(await readFile(templateUrl, 'utf8'));
  const config = communityRadarConfig(seed, template);
  if (!config) return { status: 'disabled', count: 0 };
  let stored = { version: 1, communities: [] };
  try { stored = JSON.parse(await readFile(outputUrl, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const found = [];
  const statuses = [];
  for (const [index, query] of communityRadarQueries(config).entries()) {
    const result = await search(query, index);
    statuses.push(result.status);
    if (result.executed && result.status === 'sources-found') found.push(...result.candidates);
  }
  const incoming = normalizeCommunityCandidates(found, config);
  const communities = mergeCommunityRecords(stored.communities, incoming);
  await mkdir(new URL('./', outputUrl), { recursive: true });
  await writeFile(outputUrl, JSON.stringify({ version: 1, outreachEnabled: false, communities }, null, 2) + '\n');
  return { status: incoming.length ? 'discovered' : 'no-verified-sources', count: incoming.length,
    total: communities.filter(c => c.parcelId === seed.parcelId).length, statuses, contacted: 0 };
}
