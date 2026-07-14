(function publisherSnapshotOnceModule(global) {
  "use strict";

  const base = String(global.PoulpeRuntimeConfig?.urls?.publisherApi || "").replace(/\/$/, "");
  const endpoint = `${base}/api/poulpe-life/state`;
  let done = false;

  function mergeSeed(localSeed, remoteSeed) {
    if (!localSeed || !remoteSeed) return;
    const localOnly = {
      objective: localSeed.objective,
      firstHarvest: localSeed.firstHarvest,
      priority: localSeed.priority,
      type: localSeed.type,
    };
    Object.assign(localSeed, remoteSeed, localOnly, {
      status: remoteSeed.status || localSeed.status || "planted",
      maturity: Number(remoteSeed.maturity || 0),
      gardener: "gerard",
      plantedBy: "gerard",
      runtime: "server",
    });
  }

  async function loadOnce() {
    if (done || !base || !global.BlacklaceParcel?.parcel) return;
    done = true;

    const controller = new AbortController();
    const timeout = global.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      const data = await response.json();
      const remoteSeeds = Array.isArray(data?.seeds) ? data.seeds : [];
      const byId = new Map(remoteSeeds.map((seed) => [String(seed.id), seed]));

      (global.BlacklaceParcel.parcel.seeds || []).forEach((localSeed) => {
        const remoteSeed = byId.get(String(localSeed.id));
        if (!remoteSeed) return;
        mergeSeed(localSeed, remoteSeed);
        try { global.GardenStore?.updateSeed?.(localSeed.id, localSeed); } catch (_) {}
      });

      global.__publisherSnapshot = {
        loadedAt: new Date().toISOString(),
        seeds: remoteSeeds.length,
        events: Array.isArray(data?.events) ? data.events.length : 0,
      };

      if (typeof global.render === "function") global.render();
      global.MobileViewGuard?.apply?.();
    } catch (error) {
      global.__publisherSnapshot = {
        loadedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      global.clearTimeout(timeout);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => global.setTimeout(() => void loadOnce(), 250), { once: true });
  } else {
    global.setTimeout(() => void loadOnce(), 250);
  }

  global.PublisherSnapshotOnce = { loadOnce, isDone: () => done };
})(globalThis);
