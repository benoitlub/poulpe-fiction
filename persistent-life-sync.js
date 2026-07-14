(function persistentLifeSyncModule(global) {
  "use strict";

  const API_BASE = global.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-api.onrender.com";
  const EVENTS_KEY = "poulpe-fiction:server-life-events:v1";
  const REFRESH_MS = 60_000;
  let syncing = false;

  async function request(path, options) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
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
    global.render?.();
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

  global.PersistentLifeSync = {
    sync,
    events: () => {
      try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); } catch (_) { return []; }
    },
  };

  void sync();
  global.setInterval(() => void sync(), REFRESH_MS);
  global.addEventListener?.("focus", () => void sync());
})(globalThis);
