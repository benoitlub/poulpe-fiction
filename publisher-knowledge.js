(function publisherKnowledgeModule(global) {
  "use strict";

  const CACHE_KEY = "poulpe-fiction:publisher-knowledge-cache:v2";
  const LEGACY_CACHE_KEYS = ["poulpe-fiction:publisher-knowledge-cache:v1"];
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;

  // The dynamic PUBLISHER_API relay (Cloudflare Worker) has no live backend
  // behind it — every /api/knowledge-packs call 405s. What actually curates
  // knowledge autonomously today is blacklace-publisher-ai's daily Notion
  // sync (Autonomous Knowledge Observatory), published as static JSON on
  // GitHub Pages. That's the real "ask Publisher what it knows" source.
  const KNOWLEDGE_PACKS_BASE_URL = "https://benoitlub.github.io/blacklace-publisher-ai/knowledge-packs";

  function clearLegacyCaches() {
    for (const key of LEGACY_CACHE_KEYS) {
      try { localStorage.removeItem(key); } catch (_) {}
    }
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeCache(seedId, value) {
    const cache = readCache();
    cache[seedId] = value;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function cached(seedId) {
    const value = readCache()[seedId] || null;
    if (!value?.verified || !value?.prompt) return null;
    const fetchedAt = Date.parse(value.fetchedAt || "");
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > MAX_AGE_MS) return null;
    return value;
  }

  function localPack(seedId) {
    const pack = global.ProductKnowledge?.get?.(seedId);
    if (!pack?.verified) return null;
    const prompt = global.ProductKnowledge?.toPrompt?.(pack) || "";
    if (!prompt) return null;
    return {
      version: 2,
      slug: seedId,
      verified: true,
      source: "local-product-knowledge",
      fetchedAt: new Date().toISOString(),
      prompt,
      items: [pack],
      diagnostics: { connected: false, local: true }
    };
  }

  function unavailable(seedId, reason, diagnostics) {
    return {
      version: 2,
      slug: seedId,
      verified: false,
      source: "publisher-unavailable",
      fetchedAt: new Date().toISOString(),
      prompt: "",
      items: [],
      diagnostics: { connected: false, error: reason || "Publisher indisponible", ...(diagnostics || {}) }
    };
  }

  // Maps blacklace-publisher-ai's real Knowledge Pack shape
  // ({status:"verified"|"empty", sources:[{title,url,content}]}) to the
  // contract the rest of Gérard's code expects ({verified, prompt}).
  function mapStaticPack(seedId, payload) {
    if (!payload || typeof payload !== "object") return null;
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const prompt = sources
      .map((source) => {
        const title = String(source?.title || "Source").trim();
        const url = source?.url ? ` (${source.url})` : "";
        const content = String(source?.content || "").trim();
        return content ? `## ${title}${url}\n${content}` : "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();

    return {
      version: 2,
      slug: seedId,
      verified: payload.status === "verified" && Boolean(prompt),
      source: "publisher-knowledge-observatory",
      fetchedAt: payload.generatedAt || new Date().toISOString(),
      prompt,
      items: sources.map((source) => ({ title: source?.title, url: source?.url, content: source?.content })),
      diagnostics: {
        connected: true,
        status: payload.status || "unknown",
        sourceCount: Number.isFinite(payload.sourceCount) ? payload.sourceCount : sources.length,
      }
    };
  }

  async function fetchStaticPack(seedId) {
    const request = global.PoulpeRuntimeConfig?.withTimeout || fetch;
    const response = await request(`${KNOWLEDGE_PACKS_BASE_URL}/${encodeURIComponent(seedId)}.json`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    }, 8000);
    if (!response.ok) throw new Error(`Publisher knowledge pack indisponible (${response.status})`);
    const payload = await response.json();
    return mapStaticPack(seedId, payload);
  }

  async function load(seedId, options = {}) {
    if (!seedId) return null;
    clearLegacyCaches();

    const fresh = cached(seedId);
    if (fresh && !options.forceRefresh) return fresh;

    const local = localPack(seedId);

    try {
      const remote = await fetchStaticPack(seedId);
      if (remote?.verified && remote.prompt) {
        writeCache(seedId, remote);
        return remote;
      }
      // Publisher answered but has no verified source for this Seed yet
      // (autonomous Notion sync hasn't found anything to curate).
      if (local) {
        writeCache(seedId, local);
        return local;
      }
      return unavailable(seedId, "Publisher n'a pas encore de source vérifiée pour cette Seed.", remote?.diagnostics);
    } catch (error) {
      if (local) {
        writeCache(seedId, local);
        return local;
      }
      return unavailable(seedId, error instanceof Error ? error.message : "Publisher indisponible");
    }
  }

  function clear(seedId) {
    const cache = readCache();
    if (seedId) delete cache[seedId];
    else Object.keys(cache).forEach((key) => delete cache[key]);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  clearLegacyCaches();
  global.PublisherKnowledge = { CACHE_KEY, KNOWLEDGE_PACKS_BASE_URL, load, cached, clear, localPack };
})(globalThis);
