(function gardenPersistenceModule(global) {
  "use strict";

  const DASHBOARD_KEY = "poulpe-fiction:garden-dashboard:v1";
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
      const base = typeof global.PUBLISHER_API === "string" ? global.PUBLISHER_API : "";
      const configured = localStorage.getItem("PUBLISHER_FRONTEND_URL") || "";
      const fallback = base.includes("blacklace-publisher-api")
        ? "https://blacklace-publisher.onrender.com"
        : base;
      return (configured || fallback || "https://blacklace-publisher.onrender.com").replace(/\/api$/, "").replace(/\/$/, "");
    } catch (_) {
      return "https://blacklace-publisher.onrender.com";
    }
  }

  function snapshot() {
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
    setMissionFilter
  };
})(globalThis);
