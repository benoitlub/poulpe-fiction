(function gardenStoreModule(global) {
  "use strict";

  const STORAGE_KEY = "poulpe-fiction:garden-domain:v1";

  function emptyState() {
    return {
      version: 1,
      parcels: [],
      seeds: [],
      sprouts: [],
      harvests: [],
      operations: [],
      compost: [],
      activeParcelId: null,
      activeSeedId: null,
      updatedAt: null
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value && typeof value === "object" ? Object.assign(emptyState(), value) : emptyState();
    } catch (_) {
      return emptyState();
    }
  }

  let state = loadState();

  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return snapshot();
  }

  function snapshot() {
    return clone(state);
  }

  function upsert(listName, record, key) {
    const list = state[listName];
    const index = list.findIndex((item) => item[key] === record[key]);
    if (index >= 0) list[index] = Object.assign({}, list[index], record);
    else list.push(record);
    persist();
    return record;
  }

  function registerParcel(parcel) {
    if (!parcel?.id) throw new Error("GardenStore.registerParcel requires an id");
    const record = {
      id: String(parcel.id),
      code: String(parcel.code || parcel.id),
      name: String(parcel.name || parcel.id),
      mission: String(parcel.mission || ""),
      priorities: Array.isArray(parcel.priorities) ? parcel.priorities.map(String) : [],
      version: Number(parcel.version || 1),
      updatedAt: new Date().toISOString()
    };
    upsert("parcels", record, "id");

    if (Array.isArray(parcel.seeds)) {
      parcel.seeds.forEach((seed) => plantSeed(Object.assign({}, seed, {
        parcelId: record.id,
        kind: seed.kind || seed.type,
        content: seed.content || seed.objective,
        source: seed.source || "blacklace-parcel"
      }), { silent: true }));
      persist();
    }
    return record;
  }

  function plantSeed(input, options) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const seed = domain.createSeed(input);
    const existing = state.seeds.find((item) => item.id === seed.id);
    if (existing) {
      Object.assign(existing, seed, {
        createdAt: existing.createdAt || seed.createdAt,
        updatedAt: new Date().toISOString()
      });
    } else {
      state.seeds.push(seed);
    }
    if (!options?.silent) persist();
    return seed;
  }

  function updateSeed(seedId, patch) {
    const seed = state.seeds.find((item) => item.id === seedId);
    if (!seed) return null;
    Object.assign(seed, patch || {}, { updatedAt: new Date().toISOString() });
    persist();
    return clone(seed);
  }

  function activateSeed(parcelId, seedId) {
    const seed = state.seeds.find((item) => item.id === seedId && item.parcelId === parcelId);
    if (!seed) throw new Error(`Unknown Garden seed: ${seedId}`);
    state.activeParcelId = parcelId;
    state.activeSeedId = seedId;
    persist();
    return clone(seed);
  }

  function activeSeed() {
    return state.seeds.find((item) => item.id === state.activeSeedId && item.parcelId === state.activeParcelId) || null;
  }

  function addSprout(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const sprout = domain.createSprout(input);
    if (!state.seeds.some((seed) => seed.id === sprout.seedId && seed.parcelId === sprout.parcelId)) {
      throw new Error(`Unknown Garden seed: ${sprout.seedId}`);
    }
    upsert("sprouts", sprout, "id");
    updateSeed(sprout.seedId, { status: "sprouted" });
    return sprout;
  }

  function addHarvest(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const harvest = domain.createHarvest(input);
    upsert("harvests", harvest, "id");
    if (harvest.seedId) updateSeed(harvest.seedId, { status: "harvested" });
    return harvest;
  }

  function upsertOperation(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const operation = domain.createOperation(input);
    return upsert("operations", operation, "id");
  }

  function compostSeed(input) {
    if (!input?.id || !input?.seedId || !input?.parcelId) {
      throw new Error("GardenStore.compostSeed requires id, seedId and parcelId");
    }
    const entry = {
      id: String(input.id),
      seedId: String(input.seedId),
      parcelId: String(input.parcelId),
      reason: String(input.reason || ""),
      reusableInsights: Array.isArray(input.reusableInsights) ? input.reusableInsights.map(String) : [],
      createdAt: input.createdAt || new Date().toISOString()
    };
    upsert("compost", entry, "id");
    updateSeed(entry.seedId, { status: "composted" });
    return entry;
  }

  function replaceFromParcel(parcel, activeContext) {
    registerParcel(parcel);
    if (activeContext?.parcelId && activeContext?.seedId) {
      try { activateSeed(activeContext.parcelId, activeContext.seedId); }
      catch (_) {}
    }
    return snapshot();
  }

  global.GardenStore = {
    STORAGE_KEY,
    snapshot,
    persist,
    registerParcel,
    replaceFromParcel,
    plantSeed,
    updateSeed,
    activateSeed,
    activeSeed,
    addSprout,
    addHarvest,
    upsertOperation,
    compostSeed
  };
})(globalThis);
