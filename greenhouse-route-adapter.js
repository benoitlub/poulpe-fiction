(function greenhouseRouteAdapter(global) {
  "use strict";

  const previousFetch = global.fetch?.bind(global);
  if (!previousFetch || global.__greenhouseRouteAdapterInstalled) return;

  function requestUrl(input) {
    return typeof input === "string" ? input : input?.url || "";
  }

  function isGreenhouse(url) {
    return /\/api\/greenhouse(?:\?|$)/.test(url);
  }

  function isBlacklaceGlobalState(url) {
    return /\/api\/global-state\/parcels\/blacklace-ecosystem(?:\?|$)/.test(url);
  }

  function persistentStateUrl(url) {
    return url
      .replace(/\/api\/greenhouse(?:\?.*)?$/, "/api/poulpe-life/state")
      .replace(/\/api\/global-state\/parcels\/blacklace-ecosystem(?:\?.*)?$/, "/api/poulpe-life/state");
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  function toCutting(seed) {
    const maturity = Number(seed?.maturity || 0);
    return {
      id: seed?.id,
      title: seed?.title || seed?.id || "Seed",
      description: seed?.objective || seed?.firstHarvest || "Seed persistante cultivée par Gérard.",
      notes: `Statut : ${seed?.status || "planted"} · maturité ${Math.round(maturity * 10) / 10} %`,
      capabilities: [
        seed?.status ? `statut ${seed.status}` : null,
        seed?.runtime === "server" ? "culture serveur" : null,
        seed?.gardener === "gerard" ? "jardinée par Gérard" : null,
      ].filter(Boolean),
      maturity,
      status: seed?.status || "planted",
      parcelId: seed?.parcelId,
      runtime: seed?.runtime || "server",
      lastCultivatedAt: seed?.lastCultivatedAt || null,
    };
  }

  function toLegacyParcel(state) {
    const parcels = Array.isArray(state?.parcels) ? state.parcels : [];
    const seeds = Array.isArray(state?.seeds) ? state.seeds : [];
    const sourceParcel = parcels.find((parcel) => parcel?.id === "blacklace-ecosystem") || parcels[0] || {};
    return {
      id: "blacklace-ecosystem",
      code: sourceParcel.code || "PARCEL-001",
      name: sourceParcel.name || "Écosystème Blacklace",
      mission: sourceParcel.mission,
      priorities: sourceParcel.priorities,
      seeds,
    };
  }

  async function readPersistentState(url, init) {
    return previousFetch(persistentStateUrl(url), {
      ...(init || {}),
      method: "GET",
      body: undefined,
      cache: "no-store",
    });
  }

  async function adaptedFetch(input, init = {}) {
    const url = requestUrl(input);

    if (isBlacklaceGlobalState(url)) {
      const method = String(init.method || "GET").toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        return jsonResponse({ ok: true, ignored: "legacy-global-state", authority: "poulpe-life" });
      }

      const response = await readPersistentState(url, init);
      if (!response.ok) return response;
      const state = await response.json();
      return jsonResponse({
        value: {
          parcel: toLegacyParcel(state),
          activeSeed: null,
          authority: "poulpe-life",
        },
      });
    }

    if (!isGreenhouse(url)) return previousFetch(input, init);

    const response = await readPersistentState(url, init);
    if (!response.ok) return response;

    const state = await response.json();
    const seeds = Array.isArray(state?.seeds) ? state.seeds : [];
    const events = Array.isArray(state?.events) ? state.events : [];
    return jsonResponse({
      source: "PostgreSQL · vie persistante",
      cuttings: seeds.map(toCutting),
      seeds,
      parcels: Array.isArray(state?.parcels) ? state.parcels : [],
      events,
      latestEvent: events[0] || null,
    });
  }

  global.fetch = adaptedFetch;
  global.__greenhouseRouteAdapterInstalled = true;
})(globalThis);
