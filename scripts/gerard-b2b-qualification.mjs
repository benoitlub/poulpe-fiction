import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 6500;
const MAX_BYTES = 180_000;
const SELLER = /distribut(?:ion|eur|or)|grossiste|wholesale|retailer|revendeur|reseller|boutique|shops?|stores?/i;
const GAME = /jeux? de (?:société|cartes)|board\s?games?|card\s?games?|tabletop|tcg|jouets?|toy/i;
const PARTNER = /partenair|partner|b2b|professionnel|business|contact|catalogue|catalog/i;

function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 && c === 0 ||
      a === 198 && (b === 18 || b === 19));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) return publicAddress(normalized.slice(7));
    return !(normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb'));
  }
  return false;
}

export async function isSafePublicUrl(rawUrl, resolve = lookup) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password ||
      isIP(url.hostname) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return false;
  try {
    const addresses = await resolve(url.hostname, { all: true });
    return Array.isArray(addresses) && addresses.length > 0 && addresses.every(({ address }) => publicAddress(address));
  } catch { return false; }
}

function stripHtml(html) {
  return html.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|quot|#39|lt|gt);/gi, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 12_000);
}

// Only publicly advertised mailto contacts are candidates for outreach.
// Never manufacture addresses from a domain or a person's name.
export function findPublishedContactEmail(html) {
  const candidates = [...String(html).matchAll(/href\s*=\s*["']mailto:([^"'?#\s]+)(?:\?[^"']*)?["']/gi)]
    .map(match => {
      try { return decodeURIComponent(match[1]).trim().toLowerCase(); } catch { return ""; }
    }).filter(email => /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(email));
  const unique = [...new Set(candidates)];
  const priority = /^(?:contact|partenariats?|partnerships?|commercial|bonjour|info)@/i;
  return unique.find(email => priority.test(email)) ?? unique[0] ?? null;
}

export function assessBusinessPage(candidate, html) {
  const text = stripHtml(html);
  const contactEmail = findPublishedContactEmail(html);
  const signals = [];
  if (SELLER.test(text)) signals.push('distribution-ou-vente-professionnelle');
  if (GAME.test(text)) signals.push('univers-jeux');
  if (PARTNER.test(text)) signals.push('canal-partenariat-ou-contact');
  const score = (signals.includes('distribution-ou-vente-professionnelle') ? 35 : 0) +
    (signals.includes('univers-jeux') ? 35 : 0) +
    (signals.includes('canal-partenariat-ou-contact') ? 20 : 0);
  return { ...candidate, verification: 'page-read', qualification: score >= 70 ? 'priority-review' : 'investigate',
    fitScore: score, signals, contactEmail, evidence: text.slice(0, 280),
    nextAction: score >= 70 ? 'Vérifier conditions revendeur et possibilité de proposer Pro.Hibited' :
      'Examiner manuellement la pertinence du partenariat', contacted: false };
}

export async function qualifyBusinessSources(candidates, { fetchPage = fetch, resolve = lookup } = {}) {
  const results = [];
  for (const candidate of candidates.slice(0, 10)) {
    if (!await isSafePublicUrl(candidate.url, resolve)) {
      results.push({ ...candidate, verification: 'unverified', qualification: 'investigate',
        fitScore: null, signals: [], reason: 'url-or-dns-unavailable', contacted: false });
      continue;
    }
    try {
      const response = await fetchPage(candidate.url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'text/html', 'User-Agent': 'GerardResearchBot/1.0 (read-only business research)' } });
      const contentType = response.headers?.get('content-type') ?? '';
      if (!response.ok || !/text\/html/i.test(contentType)) throw new Error('not-readable-html');
      const declaredLength = Number(response.headers?.get('content-length') || 0);
      if (declaredLength > MAX_BYTES) throw new Error('page-too-large');
      const html = (await response.text()).slice(0, MAX_BYTES);
      results.push(assessBusinessPage(candidate, html));
    } catch (error) {
      results.push({ ...candidate, verification: 'unverified', qualification: 'investigate',
        fitScore: null, signals: [], reason: String(error?.message || error).slice(0, 90), contacted: false });
    }
  }
  return results.sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
}

export function formatQualifiedSources(sources) {
  return '# Opportunités B2B — préqualification automatique\n\n' +
    'Lecture publique et indices automatiques, sans validation commerciale humaine. Aucun contact ni vente. ' +
    'Un score indique des mots-clés vérifiés sur une page, pas une volonté de partenariat.\n\n' +
    sources.map((source, index) => [
      `${index + 1}. ${source.title || 'Sans titre'} — ${source.qualification === 'priority-review' ? 'À examiner en priorité' : 'À approfondir'}`,
      `   Source : ${source.url}`,
      `   Vérification : ${source.verification}; score indicatif : ${source.fitScore ?? 'inconnu'}/90`,
      `   Indices : ${source.signals?.join(', ') || 'aucun indice vérifié'}`,
      `   Preuve : ${source.evidence || 'Page inaccessible ou non vérifiée'}`,
      `   Prochaine action : ${source.nextAction || 'Vérifier la page et la pertinence réelle'}`,
      '   Contact : aucun',
    ].join('\n')).join('\n\n');
}
