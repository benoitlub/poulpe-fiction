(function persistentLifeSyncModule(global) {
  "use strict";

  const API_BASE = global.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-api.onrender.com";
  const EVENTS_KEY = "poulpe-fiction:server-life-events:v1";
  const REFRESH_MS = 60_000;
  const REQUEST_TIMEOUT_MS = 8_000;
  let syncing = false;
  let started = false;

  async function request(path, options) {
    const controller = new AbortController();
    const timeout = global.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } finally {
      global.clearTimeout(timeout);
    }
  }

  function currentState() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [] };
  }

  async function pushLocalState() {
    const state = currentState();
    await request("/api/poulpe-life/sync", {
      method: "POST",
      body: JSON.stringify({ parcels: state.parcels || [], seeds: state.seeds || [] }),
    });
  }

  function mergeServerState(server) {
    (server.parcels || []).forEach((parcel) => {
      try { global.GardenStore?.registerParcel?.(parcel); } catch (_) {}
    });
    (server.seeds || []).forEach((seed) => {
      const local = currentState().seeds?.find((item) => item.id === seed.id);
      if (local) global.GardenStore?.updateSeed?.(seed.id, seed);
      else {
        try { global.GardenStore?.plantSeed?.(seed, { silent: true }); } catch (_) {}
      }
    });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(server.events || []));
    global.GardenStore?.persist?.();

    if (document.readyState === "complete") {
      global.render?.();
    }
  }

  async function sync() {
    if (syncing || !global.GardenStore) return;
    syncing = true;
    try {
      await pushLocalState();
      const server = await request("/api/poulpe-life/state");
      mergeServerState(server);
      global.dispatchEvent?.(new CustomEvent("poulpe-life-sync", { detail: server }));
    } catch (error) {
      console.warn("Persistent Poulpe life sync unavailable", error);
    } finally {
      syncing = false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    global.setTimeout(() => void sync(), 2_000);
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

  if (document.readyState === "complete") start();
  else global.addEventListener?.("load", start, { once: true });
})(globalThis);
