(function gerardPresenceModule(global) {
  "use strict";

  const REFRESH_MS = 15000;
  let lastSignature = "";

  function text(value) { return String(value || "").trim(); }
  function time(value) {
    const parsed = Date.parse(text(value));
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [], operations: [], harvests: [] };
  }
  function normalize(input) {
    return {
      id: text(input.id) || `presence:${text(input.pole)}:${text(input.label)}`,
      pole: text(input.pole) || "garden",
      status: text(input.status) || "observation",
      label: text(input.label),
      detail: text(input.detail),
      at: Number.isFinite(Number(input.at)) ? Number(input.at) : time(input.createdAt || input.updatedAt),
    };
  }
  function add(items, event) {
    const next = normalize(event);
    if (!next.label || items.some((item) => item.id === next.id)) return;
    items.push(next);
  }
  function parcelName(data, parcelId) {
    const parcel = (data.parcels || []).find((item) => item.id === parcelId);
    return parcel?.name || parcel?.title || parcelId || "parcelle inconnue";
  }
  function realStoreEvents() {
    const data = snapshot();
    const items = [];

    (data.seeds || []).forEach((seed) => add(items, {
      id: `store-seed:${seed.id}`,
      pole: "radar",
      status: "observation",
      label: `Seed visible · ${seed.title || seed.intent || seed.id}`,
      detail: `Parcelle : ${parcelName(data, seed.parcelId)} · état : ${seed.status || "observée"}`,
      createdAt: seed.updatedAt || seed.createdAt,
    }));

    (data.operations || []).forEach((operation) => {
      const status = text(operation.status).toLowerCase();
      const blocked = ["blocked", "failed", "waiting-authorization"].includes(status);
      const active = ["queued", "running", "active", "processing"].includes(status);
      add(items, {
        id: `store-operation:${operation.id || operation.operationId}`,
        pole: "octopus",
        status: blocked ? "blocage" : active ? "experimentation" : "observation",
        label: blocked ? `Mission retenue · ${operation.intent || operation.activity || operation.id}` : active ? `Mission en cours · ${operation.intent || operation.activity || operation.id}` : `Mission tracée · ${operation.intent || operation.activity || operation.id}`,
        detail: `${parcelName(data, operation.parcelId)} · ${operation.obstacle?.message || operation.status || "état enregistré"}`,
        createdAt: operation.updatedAt || operation.createdAt,
      });
    });

    (data.harvests || []).forEach((harvest) => add(items, {
      id: `store-harvest:${harvest.id}`,
      pole: "garden",
      status: "recolte",
      label: `Récolte disponible · ${harvest.title || harvest.name || harvest.id}`,
      detail: `Parcelle : ${parcelName(data, harvest.parcelId)} · ${harvest.status || "retour enregistré"}`,
      createdAt: harvest.updatedAt || harvest.createdAt,
    }));

    return items;
  }

  function install() {
    if (!global.ActivityEcho || global.ActivityEcho.__presenceInstalled) return false;
    const baseCollect = global.ActivityEcho.collectEvents.bind(global.ActivityEcho);
    global.ActivityEcho.collectEvents = function collectVisibleRealEvents(sources) {
      const merged = [...baseCollect(sources), ...realStoreEvents()];
      const unique = [];
      merged.sort((a, b) => Number(a.at || 0) - Number(b.at || 0)).forEach((item) => {
        if (!unique.some((known) => known.id === item.id)) unique.push(item);
      });
      return unique.slice(-12);
    };
    global.ActivityEcho.__presenceInstalled = true;
    return true;
  }

  function refreshWhenChanged() {
    if (!install()) return;
    const events = global.ActivityEcho.collectEvents();
    const signature = events.map((item) => `${item.id}:${item.status}:${item.at}`).join("|");
    if (signature === lastSignature) return;
    lastSignature = signature;
    global.ActivityEcho.mount?.();
    if (global.GardenShell && localStorage.getItem("poulpe-fiction:main-view:v1") === "activity") {
      global.GardenShell.mount?.();
    }
  }

  refreshWhenChanged();
  global.setInterval(refreshWhenChanged, REFRESH_MS);
  global.addEventListener?.("storage", refreshWhenChanged);
  global.GerardPresence = { refresh: refreshWhenChanged, realStoreEvents };
})(globalThis);
