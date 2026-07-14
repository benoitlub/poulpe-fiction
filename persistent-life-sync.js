(function persistentLifeSyncModule(global) {
  "use strict";

  const API_BASE = global.PoulpeRuntimeConfig?.urls?.publisherApi || "https://blacklace-publisher-api.onrender.com";
  const EVENTS_KEY = "poulpe-fiction:server-life-events:v1";
  const REFRESH_MS = 60_000;
  const REQUEST_TIMEOUT_MS = 8_000;
  let syncing = false;
  let started = false;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = global.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json", ...(options.headers || {}) },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } finally {
      global.clearTimeout(timeout);
    }
  }

  function mergeServerState(server) {
    (server.parcels || []).forEach((parcel) => {
      try { global.GardenStore?.registerParcel?.(parcel); } catch (_) {}
    });

    (server.seeds || []).forEach((seed) => {
      try {
        const snapshot = global.GardenStore?.snapshot?.() || { seeds: [] };
        const local = snapshot.seeds?.find((item) => item.id === seed.id);
        if (local) global.GardenStore?.updateSeed?.(seed.id, seed);
        else global.GardenStore?.plantSeed?.(seed, { silent: true });
      } catch (_) {}
    });

    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(server.events || []));
      global.GardenStore?.persist?.();
    } catch (_) {}

    global.dispatchEvent?.(new CustomEvent("poulpe-life-sync", { detail: server }));
  }

  async function sync() {
    if (syncing || !global.GardenStore) return null;
    syncing = true;
    try {
      const server = await request("/api/poulpe-life/state");
      mergeServerState(server);
      return server;
    } catch (error) {
      console.warn("Persistent Poulpe life read unavailable", error);
      return null;
    } finally {
      syncing = false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    global.setTimeout(() => void sync(), 750);
    global.setInterval(() => void sync(), REFRESH_MS);
    global.addEventListener?.("focus", () => void sync());
  }

  global.PersistentLifeSync = {
    sync,
    start,
    events: () => {
      try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); } catch (_) { return []; }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(globalThis);
