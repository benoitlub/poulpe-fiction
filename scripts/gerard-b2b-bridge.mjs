import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * The runtime's local Express Publisher adapter does not expose
 * business.sources.search. The deployed Publisher Worker does.
 * Only this read-only lookup goes directly to the Worker; all other Gérard
 * missions continue through the locally registered Octopus adapter.
 */
export function parseBusinessSourceResponse(response, { jobPostings = false } = {}) {
  const payload = response?.payload ?? {};
  const output = payload?.output ?? {};
  const valid = response?.status === 'ok' && payload?.status === 'completed' &&
    output?.capability === 'business.sources.search' && output?.executed === true &&
    ['sources-found', 'no-sources'].includes(output?.status);
  if (!valid) return {
    status: output?.status === 'blocked' ? 'blocked' : 'unavailable', candidates: [], executed: false,
    reason: String(output?.reason ?? payload?.summary ?? response?.message ?? payload?.status ?? 'adapter-unavailable').slice(0, 180),
    retryAfterSeconds: Number.isFinite(output?.retryAfterSeconds) ? output.retryAfterSeconds : null,
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
    if (jobPostings) {
      if (url.protocol !== 'https:' || item.verification !== 'source-opened') return [];
      return [{
        title: String(item.title ?? '').slice(0, 200), url: url.href,
        employer: String(item.employer ?? '').slice(0, 200), location: String(item.location ?? '').slice(0, 300),
        employmentType: String(item.employmentType ?? '').slice(0, 100), remote: item.remote === true,
        salary: String(item.salary ?? '').slice(0, 100), hours: String(item.hours ?? '').slice(0, 100), applicationEmail: item.applicationEmail,
        snippet: String(item.snippet ?? '').slice(0, 12000), verification: 'source-opened',
      }];
    }
    return [{ title: String(item.title ?? 'Sans titre').slice(0, 200), url: url.href,
      snippet: String(item.snippet ?? '').slice(0, 500), verification: 'search-result-only' }];
  }).slice(0, 10);
  return { status: accepted.length ? 'sources-found' : 'no-sources', candidates: accepted, executed: true, reason: null };
}

export async function searchBusinessSources({ publisherUrl, operationId, seed, call }) {
  const acquisition = seed?.templates?.find(t => t.id === 'client-acquisition' && t.enabled !== false)?.config;
  const query = acquisition ? [
    ...(acquisition.targetSectors || []), ...(acquisition.keywords || []),
    ...(acquisition.geographies || []), 'partenaires professionnels contact B2B',
  ].filter(Boolean).join(' ') : null;
  const jobPostings = seed.templates?.some(t => t.id === 'job-search' && t.enabled !== false);
  const mission = {
    operationId: `${operationId}-business-sources`,
    title: jobPostings ? 'Veille des offres d’emploi publiques' : acquisition ? `Recherche B2B · ${acquisition.clientId}` : 'Recherche de distributeurs et partenaires B2B',
    objective: seed.objective,
    prompt: seed.businessSearchQuery || query || seed.objective || 'Sources professionnelles B2B publiques et vérifiables',
    requiredCapabilities: ['business.sources.search'], authorizedResources: ['tools.read'],
    context: { id: seed.parcelId, metadata: { seedId: seed.seedId, clientId: acquisition?.clientId ?? null, source: 'gerard-cycle', sourceType: jobPostings ? 'job-postings' : 'business', toolRequest: { dryRun: false } } },
  };
  const response = await call(`${publisherUrl}/api/octopus-adapter/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contract: 'octopus-adapter-execution-v1', adapterId: 'publisher', mission }),
  });
  return parseBusinessSourceResponse(response, { jobPostings });
}


export async function searchPublisherJobPages(query, directory) {
  const program = String.raw`
    const { execFile } = require("node:child_process");
    const { promisify } = require("node:util");
    const { searchPublicJobPages } = require("../publisher-worker/src/job-postings.ts");
    const curl = promisify(execFile);
    const fetchPage = async url => {
      const { stdout } = await curl("curl", [
        "--silent", "--show-error", "--proto", "=https", "--max-time", "12", "--max-filesize", "2000000",
        "--write-out", "\n%{response_code}\t%{content_type}", url,
      ], { maxBuffer: 2100000 });
      const divider = stdout.lastIndexOf("\n");
      const [status, mime] = stdout.slice(divider + 1).split("\t");
      const body = Number(status) === 200 ? stdout.slice(0, divider) : null;
      return new Response(body, { status: Number(status), headers: { "content-type": mime || "" } });
    };
    searchPublicJobPages(process.argv[1], fetchPage).then(result => {
      process.stdout.write(JSON.stringify(result), () => process.exit(0));
    });
  `;
  try {
    const { stdout } = await promisify(execFile)(process.execPath,
      ["--import", "tsx", "--input-type=commonjs", "-e", program, query],
      { cwd: directory, timeout: 35000, maxBuffer: 256 * 1024 });
    const result = JSON.parse(stdout);
    if (!Number.isInteger(result?.opened) || result.opened < 1 || !Array.isArray(result.jobs)) {
      return { executed: false, reason: "publisher-job-pages-unavailable", candidates: [] };
    }
    return parseBusinessSourceResponse({
      status: "ok", payload: { status: "completed", output: {
        capability: "business.sources.search", executed: true, candidates: result.jobs,
        status: result.jobs.length ? "sources-found" : "no-sources",
      } },
    }, { jobPostings: true });
  } catch {
    return { executed: false, reason: "publisher-job-reader-failed", candidates: [] };
  }
}
