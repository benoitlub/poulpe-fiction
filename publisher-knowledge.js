(function publisherKnowledgeModule(global) {
  "use strict";

  const CACHE_KEY = "poulpe-fiction:publisher-knowledge-cache:v1";

  function publisherBaseUrl() {
    try {
      return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : "";
    } catch (_) {
      return "";
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
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function cached(seedId) {
    return readCache()[seedId] || null;
  }

  function localFallback(seedId, reason) {
    const pack = global.ProductKnowledge?.get?.(seedId) || null;
    if (!pack) return null;
    return {
      version: 1,
      slug: seedId,
      verified: Boolean(pack.verified),
      source: "local-fallback",
      sourceTitle: "ProductKnowledge local de secours",
      fetchedAt: new Date().toISOString(),
      prompt: global.ProductKnowledge?.toPrompt?.(pack) || "",
      items: [pack],
      diagnostics: { connected: false, error: reason || "Publisher indisponible", totalItems: 1, matchedItems: 1 }
    };
  }

  async function load(seedId) {
    if (!seedId) return null;
    const base = publisherBaseUrl();
    if (!base) {
      return cached(seedId) || localFallback(seedId, "PUBLISHER_API non configuré");
    }

    try {
      const response = await fetch(`${base}/api/knowledge-packs/${encodeURIComponent(seedId)}`, {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Publisher ${response.status}`);
      if (!payload?.verified || !payload?.prompt) {
        return cached(seedId) || localFallback(seedId, payload?.diagnostics?.error || "Pack Publisher non vérifié");
      }
      const result = { ...payload, source: "publisher" };
      writeCache(seedId, result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Publisher indisponible";
      return cached(seedId) || localFallback(seedId, reason);
    }
  }

  global.PublisherKnowledge = { CACHE_KEY, load, cached };
})(globalThis);
