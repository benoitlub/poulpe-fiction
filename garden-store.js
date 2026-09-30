(function gardenStoreModule(global) {
  "use strict";

  const STORAGE_KEY = "poulpe-fiction:garden-domain:v1";
  const LEGACY_ECOSYSTEM_ID = "blacklace-ecosystem";

  function emptyState() {
    return { version: 2, parcels: [], seeds: [], sprouts: [], harvests: [], operations: [], compost: [], activeParcelId: null, activeSeedId: null, updatedAt: null };
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function migrateSeed(seed) {
    const plantedAt = seed.plantedAt || seed.createdAt || seed.updatedAt || new Date().toISOString();
    return Object.assign({}, seed, {
      status: seed.status === "seed" || seed.status === "resonating" || !seed.status ? "planted" : seed.status,
      gardener: seed.gardener || "gerard",
      plantedBy: seed.plantedBy || "gerard",
      plantedAt,
      createdAt: seed.createdAt || plantedAt
    });
  }

  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const loaded = value && typeof value === "object" ? Object.assign(emptyState(), value) : emptyState();
      loaded.version = 2;
      loaded.seeds = Array.isArray(loaded.seeds) ? loaded.seeds.map(migrateSeed) : [];
      return loaded;
    } catch (_) {
      return emptyState();
    }
  }

  let state = loadState();

  // Le clone profond de l'état complet coûte ~24 ms pour 730 récoltes (≈5 Mo
  // sérialisés), et snapshot() est appelé en rafale : toutes les 5 s par
  // gerard-autonomy, à chaque montage d'écran, et une fois par écran abonné à
  // chaque « poulpe-garden-changed ». On ne reclone donc qu'après une
  // écriture : entre deux persist(), tous les lecteurs partagent le même
  // clone.
  //
  // Cela suppose qu'aucun appelant ne modifie l'objet reçu. Vérifié sur la
  // totalité d'entre eux (garden-persistence, garden-dashboard, garden-shell,
  // gerard-autonomy, gerard-local-harvester, gerard-knowledge-garden-v3,
  // production-pack, restoreGardenHarvest, browserPoulpeRuntimeAdapter,
  // GerardScreen) : tous lisent, et ceux qui trient copient d'abord le
  // tableau. Écrire dans le jardin passe par les fonctions ci-dessous, jamais
  // par le snapshot — un test verrouille cette invariante.
  let cachedSnapshot = null;

  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    cachedSnapshot = null;
    // Un seul clone pour l'événement et la valeur de retour : cette fonction
    // en produisait deux à chaque écriture.
    const next = snapshot();
    global.dispatchEvent(new CustomEvent("poulpe-garden-changed", { detail: next }));
    return next;
  }

  function snapshot() {
    if (!cachedSnapshot) cachedSnapshot = clone(state);
    return cachedSnapshot;
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
      client: parcel.client && typeof parcel.client === "object" ? clone(parcel.client) : null,
      archived: Boolean(parcel.archived),
      version: Number(parcel.version || 1),
      updatedAt: new Date().toISOString()
    };
    upsert("parcels", record, "id");

    if (Array.isArray(parcel.seeds)) {
      parcel.seeds.forEach((seed) => plantSeed(Object.assign({}, seed, {
        parcelId: record.id,
        kind: seed.kind || seed.type,
        content: seed.content || seed.objective,
        source: seed.source || "blacklace-parcel",
        status: seed.status || "planted",
        gardener: "gerard",
        plantedBy: "gerard",
        plantedAt: seed.plantedAt || seed.createdAt || new Date().toISOString()
      }), { silent: true }));
      persist();
    }
    return record;
  }

  function plantSeed(input, options) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const seed = domain.createSeed(Object.assign({}, input, {
      status: input?.status || "planted",
      gardener: input?.gardener || "gerard",
      plantedBy: input?.plantedBy || "gerard",
      plantedAt: input?.plantedAt || input?.createdAt || new Date().toISOString()
    }));
    if (input?.parentHarvestId) seed.parentHarvestId = String(input.parentHarvestId);
    if (input?.parentMissionId) seed.parentMissionId = String(input.parentMissionId);
    const existing = state.seeds.find((item) => item.id === seed.id);
    if (existing) Object.assign(existing, seed, { createdAt: existing.createdAt || seed.createdAt, plantedAt: existing.plantedAt || seed.plantedAt, updatedAt: new Date().toISOString() });
    else state.seeds.push(seed);
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

  function activeSeed() { return state.seeds.find((item) => item.id === state.activeSeedId && item.parcelId === state.activeParcelId) || null; }

  function addSprout(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const sprout = domain.createSprout(input);
    if (!state.seeds.some((seed) => seed.id === sprout.seedId && seed.parcelId === sprout.parcelId)) throw new Error(`Unknown Garden seed: ${sprout.seedId}`);
    upsert("sprouts", sprout, "id");
    updateSeed(sprout.seedId, { status: "growing" });
    return sprout;
  }

  function addHarvest(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const harvest = domain.createHarvest(input);
    if (input?.content) harvest.content = input.content;
    if (input?.payload) harvest.payload = input.payload;
    if (input?.url) harvest.url = String(input.url);
    if (input?.downloadUrl) harvest.downloadUrl = String(input.downloadUrl);
    if (input?.type) harvest.type = String(input.type);
    upsert("harvests", harvest, "id");
    if (harvest.seedId) updateSeed(harvest.seedId, { status: "harvested" });
    return harvest;
  }

  function clearActiveSeed() {
    state.activeParcelId = null;
    state.activeSeedId = null;
    persist();
    return snapshot();
  }

  function upsertOperation(input) {
    const domain = global.GardenDomain;
    if (!domain) throw new Error("GardenDomain is not loaded");
    const operation = domain.createOperation(input);
    const result = upsert("operations", operation, "id");
    if (operation.seedId) {
      const nextStatus = operation.status === "running" || operation.status === "queued" ? "adventure" : operation.status === "ready" ? "harvested" : null;
      if (nextStatus) updateSeed(operation.seedId, { status: nextStatus });
    }
    return result;
  }

  function compostSeed(input) {
    if (!input?.id || !input?.seedId || !input?.parcelId) throw new Error("GardenStore.compostSeed requires id, seedId and parcelId");
    const entry = { id: String(input.id), seedId: String(input.seedId), parcelId: String(input.parcelId), reason: String(input.reason || ""), reusableInsights: Array.isArray(input.reusableInsights) ? input.reusableInsights.map(String) : [], createdAt: input.createdAt || new Date().toISOString() };
    upsert("compost", entry, "id");
    updateSeed(entry.seedId, { status: "composted" });
    return entry;
  }

  function auditHarvestMaturity(options) {
    const now = Number(options?.now || Date.now());
    const minAgeDays = Math.max(1, Number(options?.minAgeDays) || 30);
    const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const ageDays = (value) => {
      const timestamp = Date.parse(value || "");
      return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 86400000)) : 0;
    };
    const activeHarvests = state.harvests.filter((item) => item.status !== "composted");
    const fingerprints = new Map();
    activeHarvests.forEach((harvest) => {
      const fingerprint = normalize([harvest.parcelId, harvest.title, harvest.content || harvest.preview].join(" "));
      if (!fingerprint) return;
      const group = fingerprints.get(fingerprint) || [];
      group.push(harvest);
      fingerprints.set(fingerprint, group);
    });
    const duplicateIds = new Set();
    fingerprints.forEach((group) => {
      if (group.length < 2) return;
      group.slice().sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")).slice(1).forEach((item) => duplicateIds.add(item.id));
    });
    const items = activeHarvests.map((harvest) => {
      const days = ageDays(harvest.createdAt);
      const duplicate = duplicateIds.has(harvest.id);
      const hasContent = Boolean(normalize(harvest.content || harvest.preview || harvest.title));
      const linkedOperation = harvest.operationId ? state.operations.find((item) => item.id === harvest.operationId) : null;
      let disposition = "keep";
      const reasons = [];
      if (duplicate) {
        disposition = "compost-candidate";
        reasons.push("doublon déterministe d'une récolte plus récente dans la même parcelle");
      } else if (days >= minAgeDays && linkedOperation?.status === "failed") {
        disposition = "recycle-candidate";
        reasons.push("ancienne récolte liée à une opération échouée");
      } else if (days >= minAgeDays && !hasContent) {
        disposition = "compost-candidate";
        reasons.push("ancienne récolte sans contenu exploitable détecté");
      } else {
        reasons.push(days >= minAgeDays ? "ancienne mais aucune preuve suffisante pour la composter" : "récolte récente");
      }
      return {
        harvestId: harvest.id,
        parcelId: harvest.parcelId,
        seedId: harvest.seedId || null,
        title: harvest.title || "Récolte",
        ageDays: days,
        disposition,
        reasons,
      };
    });
    const counts = items.reduce((acc, item) => {
      acc[item.disposition] = (acc[item.disposition] || 0) + 1;
      return acc;
    }, {});
    return { contract: "garden-harvest-maturity-v1", generatedAt: new Date(now).toISOString(), minAgeDays, counts, items };
  }

  function compostHarvest(input) {
    if (!input?.id || !input?.harvestId || !input?.parcelId) throw new Error("GardenStore.compostHarvest requires id, harvestId and parcelId");
    const harvest = state.harvests.find((item) => item.id === String(input.harvestId) && item.parcelId === String(input.parcelId));
    if (!harvest) throw new Error(`Unknown Garden harvest: ${input.harvestId}`);
    const entry = {
      id: String(input.id),
      kind: "harvest",
      harvestId: String(input.harvestId),
      seedId: harvest.seedId || (input.seedId ? String(input.seedId) : null),
      parcelId: String(input.parcelId),
      reason: String(input.reason || ""),
      reusableInsights: Array.isArray(input.reusableInsights) ? input.reusableInsights.map(String) : [],
      sourceTitle: String(harvest.title || "Récolte"),
      sourceCreatedAt: harvest.createdAt || null,
      createdAt: input.createdAt || new Date().toISOString()
    };
    upsert("compost", entry, "id");
    harvest.status = "composted";
    harvest.compostedAt = entry.createdAt;
    harvest.compostId = entry.id;
    persist();
    return clone(entry);
  }

  function projectParcelId(seedId) {
    return `project-${String(seedId)}`;
  }

  function materializeLegacyProjects(parcel, activeContext) {
    state.parcels = state.parcels.filter((item) => item.id !== LEGACY_ECOSYSTEM_ID);

    parcel.seeds.forEach((seed, index) => {
      registerParcel({
        id: projectParcelId(seed.id),
        code: `PROJECT-${String(index + 1).padStart(3, "0")}`,
        name: seed.title || seed.id,
        mission: seed.objective || parcel.mission || "",
        priorities: [seed.firstHarvest || "récolte concrète", ...(parcel.priorities || [])],
        version: Number(parcel.version || 1),
        seeds: [seed]
      });
    });

    if (activeContext?.seedId) {
      try { activateSeed(projectParcelId(activeContext.seedId), activeContext.seedId); } catch (_) {}
    }

    persist();
    return snapshot();
  }

  function replaceFromParcel(parcel, activeContext) {
    if (parcel?.id === LEGACY_ECOSYSTEM_ID && Array.isArray(parcel.seeds) && parcel.seeds.length > 1) {
      return materializeLegacyProjects(parcel, activeContext);
    }

    registerParcel(parcel);
    if (activeContext?.parcelId && activeContext?.seedId) {
      try { activateSeed(activeContext.parcelId, activeContext.seedId); } catch (_) {}
    }
    return snapshot();
  }

  persist();

  global.GardenStore = { STORAGE_KEY, snapshot, persist, registerParcel, replaceFromParcel, plantSeed, updateSeed, activateSeed, clearActiveSeed, activeSeed, addSprout, addHarvest, upsertOperation, compostSeed, compostHarvest, auditHarvestMaturity };
})(globalThis);
