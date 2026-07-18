(function publisherKnowledgeModule(global) {
  "use strict";

  const CACHE_KEY = "poulpe-fiction:publisher-knowledge-cache:v2";
  const LEGACY_CACHE_KEYS = ["poulpe-fiction:publisher-knowledge-cache:v1"];
  const MAX_AGE_MS = 15 * 60 * 1000;

  function publisherBaseUrl() {
    try {
      return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : "";
    } catch (_) {
      return "";
    }
  }

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
    if (!value?.verified || !value?.prompt || value?.source !== "publisher") return null;
    const fetchedAt = Date.parse(value.fetchedAt || "");
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > MAX_AGE_MS) return null;
    return value;
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

  async function load(seedId, options = {}) {
    if (!seedId) return null;
    clearLegacyCaches();

    const base = publisherBaseUrl();
    if (!base) return unavailable(seedId, "PUBLISHER_API non configuré");

    if (!options.forceRefresh) {
      const fresh = cached(seedId);
      if (fresh) return fresh;
    }

    try {
      const request = global.PoulpeRuntimeConfig?.withTimeout || fetch;
      const response = await request(`${base}/api/knowledge-packs/${encodeURIComponent(seedId)}?refresh=1`, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        cache: "no-store"
      }, 12000);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Publisher ${response.status}`);
      if (!payload?.verified || !payload?.prompt) {
        return unavailable(seedId, payload?.diagnostics?.error || "Pack Publisher non vérifié", payload?.diagnostics);
      }
      const result = { ...payload, source: "publisher", fetchedAt: payload.fetchedAt || new Date().toISOString() };
      writeCache(seedId, result);
      return result;
    } catch (error) {
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
  global.PublisherKnowledge = { CACHE_KEY, load, cached, clear };
})(globalThis);
