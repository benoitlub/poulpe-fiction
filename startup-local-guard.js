(function startupLocalGuard(global) {
  "use strict";

  const nativeFetch = global.fetch?.bind(global);
  if (!nativeFetch || global.__startupLocalGuardInstalled) return;

  function urlOf(input) {
    return typeof input === "string" ? input : input?.url || "";
  }

  function json(payload) {
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }));
  }

  function localGardenSnapshot() {
    try {
      const stored = JSON.parse(localStorage.getItem("poulpe-fiction:garden-domain:v1") || "null");
      return {
        parcels: Array.isArray(stored?.parcels) ? stored.parcels : [],
        seeds: Array.isArray(stored?.seeds) ? stored.seeds : [],
        events: [],
      };
    } catch (_) {
      return { parcels: [], seeds: [], events: [] };
    }
  }

  global.fetch = function guardedStartupFetch(input, init = {}) {
    const url = urlOf(input);
    const method = String(init.method || "GET").toUpperCase();

    if ((method === "GET" || method === "HEAD") && /\/health(?:\?|$)/.test(url)) {
      return json({ status: "deferred", mode: "local-startup", message: "Octopus sera interrogé lors d'une action." });
    }

    if ((method === "GET" || method === "HEAD") && /\/api\/(?:greenhouse|poulpe-life\/state)(?:\?|$)/.test(url)) {
      const snapshot = localGardenSnapshot();
      return json({
        source: "Poulpe Fiction · démarrage local",
        cuttings: snapshot.seeds.map((seed) => ({
          id: seed.id,
          title: seed.title || seed.intent || seed.id,
          description: seed.objective || seed.firstHarvest || "Seed locale",
          capabilities: [seed.status || "planted"],
          status: seed.status || "planted",
          maturity: Number(seed.maturity || 0),
          parcelId: seed.parcelId,
        })),
        ...snapshot,
      });
    }

    if ((method === "GET" || method === "HEAD") && /\/api\/global-state\/parcels\/blacklace-ecosystem(?:\?|$)/.test(url)) {
      const snapshot = localGardenSnapshot();
      return json({ value: { parcel: snapshot.parcels[0] || null, activeSeed: null, authority: "local-startup" } });
    }

    return nativeFetch(input, init);
  };

  global.__startupLocalGuardInstalled = true;
})(globalThis);
