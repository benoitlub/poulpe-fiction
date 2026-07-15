(function gardenPersistenceModule(global) {
  "use strict";

  const DASHBOARD_KEY = "poulpe-fiction:garden-dashboard:v1";
  const HARVEST_STATE_KEY = "poulpe-fiction:harvest-state:v1";
  const VERSION = 1;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function gardenState() {
    return global.GardenStore?.snapshot?.() || {
      parcels: [],
      seeds: [],
      sprouts: [],
      harvests: [],
      operations: []
    };
  }

  function activeSeed() {
    return global.BlacklaceParcel?.activeSeed?.() || null;
  }

  function dashboardState() {
    const saved = readJson(DASHBOARD_KEY, {});
    return {
      version: VERSION,
      selectedView: saved.selectedView || "hublot",
      selectedParcelId: saved.selectedParcelId || null,
      missionFilter: saved.missionFilter || "now"
    };
  }

  function saveDashboardState(patch) {
    const current = dashboardState();
    return writeJson(DASHBOARD_KEY, Object.assign({}, current, patch || {}, {
      version: VERSION,
      updatedAt: new Date().toISOString()
    }));
  }

  function returnBundles() {
    return asArray(global.AdventureReturnProcessor?.loadOutbox?.());
  }

  function harvestState() {
    const value = readJson(HARVEST_STATE_KEY, { accepted: {}, improvements: [] });
    return value && typeof value === "object" ? Object.assign({ accepted: {}, improvements: [] }, value) : { accepted: {}, improvements: [] };
  }

  function saveHarvestState(patch) {
    return writeJson(HARVEST_STATE_KEY, Object.assign({}, harvestState(), patch || {}, {
      version: VERSION,
      updatedAt: new Date().toISOString()
    }));
  }

  function syncReturnOperations() {
    if (!global.GardenStore?.upsertOperation) return;
    const current = gardenState();
    const existing = new Map(asArray(current.operations).map((operation) => [operation.id, operation]));
    const active = activeSeed();
    returnBundles().forEach((bundle) => {
      if (!bundle?.missionId || !bundle?.parcelId || !asArray(bundle.harvests).length) return;
      const seedId = bundle.rawMission?.seedId || bundle.seedId || active?.seedId || active?.id || asArray(bundle.harvests)[0]?.seedId || `return-${bundle.missionId}`;
      const present = existing.get(bundle.missionId);
      if (present?.status === "ready") return;
      try {
        global.GardenStore.upsertOperation({
          id: bundle.missionId,
          parcelId: bundle.parcelId,
          seedId,
          intent: bundle.rawMission?.intent || bundle.rawMission?.objective || "Retour de récolte",
          status: "ready",
          activity: asArray(bundle.harvests)[0]?.title || "Récolte disponible",
          createdAt: bundle.createdAt,
          updatedAt: bundle.createdAt || new Date().toISOString()
        });
      } catch (_) {}
    });
  }

  function productionPacks() {
    return asArray(global.ProductionPack?.load?.());
  }

  function adventureDraft() {
    return global.AdventureDraft?.load?.() || null;
  }

  function dreams() {
    const key = global.DREAMS_KEY || "poulpe-fiction:dreams:v1";
    const value = readJson(key, { lastPlay: null, dreamsByDate: {} });
    return value && typeof value === "object" ? value : { lastPlay: null, dreamsByDate: {} };
  }

  function attractions() {
    const key = global.ATTRACTIONS_KEY || "poulpe-fiction:greenhouse-attractions:v1";
    const value = readJson(key, { date: null, items: {} });
    return value && typeof value === "object" ? value : { date: null, items: {} };
  }

  function runtimeRecord() {
    return global.GardenRuntime?.state?.record || global.GardenRuntime?.localFallback?.() || null;
  }

  function publisherUrl() {
    try {
      return global.PoulpeRuntimeConfig.urls.publisherFrontend.replace(/\/$/, "");
    } catch (_) {
      return "https://blacklace-publisher-web.onrender.com";
    }
  }

  function snapshot() {
    syncReturnOperations();
    return {
      version: VERSION,
      dashboard: dashboardState(),
      garden: gardenState(),
      activeSeed: activeSeed(),
      adventureDraft: adventureDraft(),
      returns: returnBundles(),
      productionPacks: productionPacks(),
      dreams: dreams(),
      attractions: attractions(),
      runtime: runtimeRecord(),
      harvestState: harvestState(),
      publisherUrl: publisherUrl(),
      capturedAt: new Date().toISOString()
    };
  }

  function selectView(view) {
    saveDashboardState({ selectedView: view });
    global.render?.();
  }

  function selectParcel(parcelId) {
    saveDashboardState({ selectedParcelId: parcelId, selectedView: "parcels" });
    global.render?.();
  }

  function setMissionFilter(filter) {
    saveDashboardState({ missionFilter: filter, selectedView: "missions" });
    global.render?.();
  }

  function acceptHarvest(input) {
    const harvestId = String(input?.id || input || "");
    const state = harvestState();
    state.accepted[harvestId] = { status: "accepted", acceptedAt: new Date().toISOString() };
    if (input && typeof input === "object" && global.GardenStore?.addHarvest && input.parcelId) {
      try {
        global.GardenStore.addHarvest({
          id: harvestId,
          parcelId: input.parcelId,
          seedId: input.seedId || `accepted-${harvestId}`,
          operationId: input.missionId || null,
          title: input.title || "Récolte",
          preview: input.preview || input.content?.text || "",
          status: "accepted",
          createdAt: input.date || new Date().toISOString()
        });
      } catch (_) {}
    }
    saveHarvestState(state);
    return state.accepted[harvestId];
  }

  function requestHarvestImprovement(input) {
    const title = String(input?.title || "Récolte");
    const harvestId = String(input?.harvestId || "");
    const missionId = String(input?.missionId || "");
    const parcelId = String(input?.parcelId || "poulpe-fiction");
    const content = String(input?.content || "").trim();
    if (!harvestId || !content) return null;
    const seed = global.GardenStore?.plantSeed?.({
      id: `improvement-${harvestId}-${Date.now()}`,
      parcelId,
      kind: "request",
      title: `Amélioration · ${title}`,
      content,
      objective: content,
      status: "planted",
      source: "harvest-improvement",
      tags: ["amélioration"],
      parentHarvestId: harvestId,
      parentMissionId: missionId || null,
      createdAt: new Date().toISOString()
    });
    const state = harvestState();
    state.improvements = [...asArray(state.improvements), { harvestId, missionId, seedId: seed?.id || null, content, createdAt: new Date().toISOString() }];
    saveHarvestState(state);
    return seed || null;
  }

  global.GardenPersistence = {
    VERSION,
    DASHBOARD_KEY,
    readJson,
    writeJson,
    snapshot,
    dashboardState,
    saveDashboardState,
    selectView,
    selectParcel,
    setMissionFilter,
    harvestState,
    acceptHarvest,
    requestHarvestImprovement
  };
})(globalThis);
