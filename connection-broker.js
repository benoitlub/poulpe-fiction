(function connectionBrokerModule(global) {
  "use strict";

  const CACHE_KEY = "poulpe-fiction:connection-broker-cache:v1";

  function publisherBaseUrl() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
    catch (_) { return ""; }
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }

  function writeCache(key, value) {
    const cache = readCache();
    cache[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function cacheKey(seedId, stepId) { return `${seedId}:${stepId}`; }

  async function planStep(seedId, step) {
    const key = cacheKey(seedId, step.id);
    const base = publisherBaseUrl();
    if (!base) return readCache()[key] || offlinePlan(seedId, step, "PUBLISHER_API non configuré");

    try {
      const response = await fetch(`${base}/api/connection-broker/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ seedId, step })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Publisher ${response.status}`);
      writeCache(key, payload);
      return payload;
    } catch (error) {
      return readCache()[key] || offlinePlan(seedId, step, error instanceof Error ? error.message : "Broker indisponible");
    }
  }

  async function planAll(seedId, steps) {
    return Promise.all((steps || []).map((step) => planStep(seedId, step)));
  }

  function offlinePlan(seedId, step, reason) {
    const name = step.providers?.[0] || step.provider || "outil à choisir";
    return {
      version: 1,
      seedId,
      stepId: step.id,
      capability: step.role,
      decisionMode: "offline-fallback",
      bridge: { mistral: "unknown", composio: "unknown" },
      selected: {
        id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        role: step.role,
        route: "manual",
        connectionStatus: "not-configured",
        authorization: "required",
        creditStatus: "unknown",
        freeTier: { available: false, checkedAt: null },
        trial: { available: false, checkedAt: null },
        reason,
        source: "local-template"
      },
      alternatives: [],
      executable: false,
      requiresHumanAuthorization: true,
      note: reason
    };
  }

  function status(provider) {
    const normalized = String(provider || "").toLowerCase();
    const plans = Object.values(readCache());
    const match = plans.find((plan) => String(plan?.selected?.name || "").toLowerCase() === normalized);
    return match?.selected?.connectionStatus || "not-configured";
  }

  function routeLabel(route) {
    return ({ composio: "via Composio", "direct-api": "API directe", manual: "manuel" })[route] || route || "route inconnue";
  }

  function connectionLabel(status) {
    return ({
      connected: "✅ Connecté",
      "authorization-required": "🔐 Autorisation requise",
      "not-configured": "Autorisation nécessaire",
      unavailable: "⛔ Indisponible"
    })[status] || status || "inconnu";
  }

  function creditLabel(status) {
    return ({ available: "crédits disponibles", limited: "crédits limités", exhausted: "crédits épuisés", unknown: "crédits inconnus" })[status] || "crédits inconnus";
  }

  global.ConnectionBroker = { CACHE_KEY, planStep, planAll, status, routeLabel, connectionLabel, creditLabel };
  global.ProductionAdapters = { status };
})(globalThis);
