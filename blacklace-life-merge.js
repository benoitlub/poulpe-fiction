(function blacklaceLifeMergeModule(global) {
  "use strict";

  const base = String(global.PoulpeRuntimeConfig?.urls?.publisherApi || "").replace(/\/$/, "");
  const endpoint = `${base}/api/poulpe-life/state`;
  let timer = null;
  let running = false;

  function mergeSeed(localSeed, remoteSeed) {
    if (!localSeed || !remoteSeed) return;
    const preserved = {
      objective: localSeed.objective,
      firstHarvest: localSeed.firstHarvest,
      priority: localSeed.priority,
      type: localSeed.type,
    };
    Object.assign(localSeed, remoteSeed, preserved, {
      status: remoteSeed.status || localSeed.status || "planted",
      maturity: Number(remoteSeed.maturity || 0),
      runtime: remoteSeed.runtime || "server",
      gardener: "gerard",
      plantedBy: "gerard",
    });
  }

  async function refresh() {
    if (!base || running || !global.BlacklaceParcel?.parcel) return null;
    running = true;
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      const data = await response.json();
      const remoteSeeds = Array.isArray(data?.seeds) ? data.seeds : [];
      const remoteById = new Map(remoteSeeds.map((seed) => [String(seed.id), seed]));
      const localSeeds = global.BlacklaceParcel.parcel.seeds || [];

      localSeeds.forEach((localSeed) => {
        const remoteSeed = remoteById.get(String(localSeed.id));
        if (!remoteSeed) return;
        mergeSeed(localSeed, remoteSeed);
        try { global.GardenStore?.updateSeed?.(localSeed.id, localSeed); } catch (_) {}
      });

      global.__blacklaceLifeStatus = {
        ready: true,
        seeds: remoteSeeds.length,
        events: Array.isArray(data?.events) ? data.events.length : 0,
        refreshedAt: new Date().toISOString(),
      };

      global.dispatchEvent?.(new CustomEvent("blacklace-life-updated", {
        detail: {
          parcel: global.BlacklaceParcel.parcel,
          seeds: remoteSeeds,
          events: Array.isArray(data?.events) ? data.events : [],
        },
      }));
      return data;
    } catch (error) {
      global.__blacklaceLifeStatus = {
        ready: false,
        error: error instanceof Error ? error.message : String(error),
        refreshedAt: new Date().toISOString(),
      };
      return null;
    } finally {
      running = false;
    }
  }

  function start() {
    void refresh();
    global.setTimeout(() => void refresh(), 1500);
    global.setTimeout(() => void refresh(), 6000);
    timer = global.setInterval(() => void refresh(), 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  global.addEventListener?.("pagehide", () => global.clearInterval(timer), { once: true });
  global.BlacklaceLifeMerge = { refresh };
})(globalThis);
