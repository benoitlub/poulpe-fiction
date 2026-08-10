(function gerardMaintenanceModule(global) {
  "use strict";

  const TRIGGER = "gerard-maintenance";
  const EXPECTED_VALUE = "purge-and-compost-poulpe-fiction";
  const GARDEN_KEY = "poulpe-fiction:garden-domain:v1";
  const AUTONOMY_KEY = "poulpe-fiction:gerard-autonomy:v2";

  function readParam() {
    try {
      return new URLSearchParams(global.location.search).get(TRIGGER);
    } catch (_) {
      return null;
    }
  }

  function run() {
    const garden = JSON.parse(global.localStorage.getItem(GARDEN_KEY) || "{}");
    const harvestsBefore = Array.isArray(garden.harvests) ? garden.harvests : [];

    const firstBySeed = new Map();
    for (const harvest of harvestsBefore) {
      if (!harvest || !harvest.seedId) continue;
      const existing = firstBySeed.get(harvest.seedId);
      if (!existing || new Date(harvest.createdAt) < new Date(existing.createdAt)) {
        firstBySeed.set(harvest.seedId, harvest);
      }
    }
    garden.harvests = [...firstBySeed.values()];

    let composted = false;
    if (Array.isArray(garden.seeds)) {
      const target = garden.seeds.find((seed) => seed && seed.id === "poulpe-fiction");
      if (target && target.status !== "composted") {
        target.status = "composted";
        composted = true;
        const compostEntry = {
          id: `compost-${target.id}-${Date.now()}`,
          seedId: target.id,
          parcelId: target.parcelId || "poulpe-fiction",
          reason: "Objectif atteint (preuve d'autonomie obtenue) — graine méta retirée du cycle de récolte marketing, qui ne lui convenait pas.",
          reusableInsights: [],
          createdAt: new Date().toISOString(),
        };
        garden.compost = Array.isArray(garden.compost) ? garden.compost : [];
        garden.compost.push(compostEntry);
      }
    }
    if (garden.activeSeedId === "poulpe-fiction") garden.activeSeedId = null;

    garden.updatedAt = new Date().toISOString();
    global.localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));

    const autonomy = JSON.parse(global.localStorage.getItem(AUTONOMY_KEY) || "{}");
    if (autonomy.tentacles) {
      for (const seedId of Object.keys(autonomy.tentacles)) {
        autonomy.tentacles[seedId].iterations = 1;
      }
      delete autonomy.tentacles["poulpe-fiction"];
    }
    global.localStorage.setItem(AUTONOMY_KEY, JSON.stringify(autonomy));

    const message = `Récoltes : ${harvestsBefore.length} -> ${garden.harvests.length}. Graine "poulpe-fiction" ${composted ? "compostée." : "déjà compostée ou introuvable."}`;
    global.alert(message);

    const url = new URL(global.location.href);
    url.searchParams.delete(TRIGGER);
    global.location.replace(url.toString());
  }

  if (readParam() === EXPECTED_VALUE) {
    try {
      run();
    } catch (error) {
      global.alert("Échec de la maintenance : " + (error && error.message ? error.message : String(error)));
    }
  }
})(globalThis);
