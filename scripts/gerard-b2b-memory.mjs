// Memory is deliberately scoped to a parcel: Yaébali and Benoît cannot share leads.
const RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 150;

export function businessSourceKey(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, '') || '/'}`;
  } catch { return null; }
}

export function planBusinessResearch(candidates, memory = {}, now = new Date()) {
  const fresh = [];
  const reused = [];
  for (const candidate of candidates) {
    const key = businessSourceKey(candidate.url);
    const previous = key && memory[key];
    const age = previous ? now.getTime() - Date.parse(previous.examinedAt) : Infinity;
    if (previous && age >= 0 && age < RETRY_MS && previous.assessment?.verification === 'page-read') {
      reused.push({ ...candidate, ...previous.assessment, url: candidate.url, title: candidate.title,
        memoryStatus: 'previously-examined', examinedAt: previous.examinedAt });
    } else fresh.push(candidate);
  }
  return { fresh, reused };
}

function assessmentSignature(source) {
  return JSON.stringify([source.verification, source.qualification, source.fitScore, source.signals, source.evidence]);
}

export function rememberBusinessResearch(memory = {}, examined = [], now = new Date()) {
  const next = { ...memory };
  const changed = [];
  for (const source of examined) {
    const key = businessSourceKey(source.url);
    if (!key) continue;
    const previous = next[key];
    const { title, url, snippet, verification, qualification, fitScore, signals, evidence, nextAction, contacted } = source;
    const assessment = { title, url, snippet, verification, qualification, fitScore, signals, evidence, nextAction, contacted: false };
    if (!previous || assessmentSignature(previous.assessment) !== assessmentSignature(assessment)) changed.push(source);
    next[key] = { examinedAt: now.toISOString(), assessment };
  }
  const bounded = Object.fromEntries(Object.entries(next)
    .sort((a, b) => Date.parse(b[1]?.examinedAt || '') - Date.parse(a[1]?.examinedAt || ''))
    .slice(0, MAX_ENTRIES));
  return { memory: bounded, changed };
}
