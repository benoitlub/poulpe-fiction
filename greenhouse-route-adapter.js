(function greenhouseRouteAdapter(global) {
  "use strict";

  const previousFetch = global.fetch?.bind(global);
  if (!previousFetch || global.__greenhouseRouteAdapterInstalled) return;

  function shouldAdapt(input) {
    const url = typeof input === "string" ? input : input?.url;
    return typeof url === "string" && /\/api\/greenhouse(?:\?|$)/.test(url);
  }

  function stateUrl(input) {
    const url = typeof input === "string" ? input : input.url;
    return url.replace(/\/api\/greenhouse(?:\?.*)?$/, "/api/poulpe-life/state");
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

  async function adaptedFetch(input, init) {
    if (!shouldAdapt(input)) return previousFetch(input, init);

    const response = await previousFetch(stateUrl(input), {
      ...(init || {}),
      cache: "no-store",
    });

    if (!response.ok) return response;

    const state = await response.json();
    const seeds = Array.isArray(state?.seeds) ? state.seeds : [];
    const events = Array.isArray(state?.events) ? state.events : [];
    const payload = {
      source: "PostgreSQL · vie persistante",
      cuttings: seeds.map(toCutting),
      seeds,
      parcels: Array.isArray(state?.parcels) ? state.parcels : [],
      events,
      latestEvent: events[0] || null,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  global.fetch = adaptedFetch;
  global.__greenhouseRouteAdapterInstalled = true;
})(globalThis);
