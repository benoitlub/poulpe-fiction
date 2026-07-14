(function gerardGerminationModule(global) {
  "use strict";

  const GERMINATION_KEY = "poulpe-fiction:gerard-germination:v1";
  const TERMINAL_STATUSES = new Set(["bag-ready", "adventure", "harvested", "composted"]);
  let running = false;

  function nowIso() {
    return new Date().toISOString();
  }

  function readReceipt() {
    try {
      return JSON.parse(localStorage.getItem(GERMINATION_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function writeReceipt(seedIds) {
    const previous = readReceipt();
    const receipt = {
      version: 1,
      parcelId: global.BlacklaceParcel?.PARCEL_ID || "blacklace-ecosystem",
      germinatedSeedIds: seedIds,
      germinatedAt: previous?.germinatedAt || nowIso(),
      refreshedAt: nowIso()
    };
    localStorage.setItem(GERMINATION_KEY, JSON.stringify(receipt));
    return receipt;
  }

  function germinateSeed(seed) {
    if (!seed || TERMINAL_STATUSES.has(seed.status)) return false;

    const timestamp = nowIso();
    seed.status = "growing";
    seed.gardener = "gerard";
    seed.plantedBy = "gerard";
    seed.plantedAt = seed.plantedAt || seed.createdAt || timestamp;
    seed.observedAt = seed.observedAt || timestamp;
    seed.germinatedAt = seed.germinatedAt || timestamp;
    seed.updatedAt = timestamp;

    try {
      global.GardenStore?.updateSeed?.(seed.id, {
        status: "growing",
        gardener: "gerard",
        plantedBy: "gerard",
        plantedAt: seed.plantedAt,
        observedAt: seed.observedAt,
        germinatedAt: seed.germinatedAt
      });
    } catch (error) {
      console.warn("Gérard n'a pas pu synchroniser la germination", seed.id, error);
    }

    return true;
  }

  async function germinateAll() {
    if (running) return null;
    const garden = global.BlacklaceParcel;
    const seeds = garden?.parcel?.seeds;
    if (!Array.isArray(seeds) || !seeds.length) return null;

    running = true;
    try {
      const germinatedIds = [];
      for (const seed of seeds) {
        if (germinateSeed(seed)) germinatedIds.push(seed.id);
      }

      const draft = global.AdventureDraft?.load?.();
      if (draft && draft.status !== "cancelled") {
        const draftSeed = seeds.find((seed) => seed.id === draft.curiosity?.id);
        if (draftSeed) {
          draftSeed.status = "bag-ready";
          draftSeed.adventureDraftId = draft.id;
          try {
            global.GardenStore?.updateSeed?.(draftSeed.id, {
              status: "bag-ready",
              adventureDraftId: draft.id,
              bagPreparedAt: draft.updatedAt || nowIso()
            });
          } catch (_) {}
        }
      }

      writeReceipt(seeds.filter((seed) => seed.status === "growing").map((seed) => seed.id));
      garden.syncGardenDomain?.(garden.activeSeed?.());
      await garden.writeGlobalState?.(garden.activeSeed?.());

      if (!draft || draft.status === "cancelled") {
        await garden.ensureGerardCultivation?.();
      }

      const previous = readReceipt();
      if (germinatedIds.length && !previous?.announcedAt) {
        try {
          global.pushChat?.("gerard", `🌿 J'ai mis les ${seeds.length} Seeds à germer. Je les observe toutes en parallèle et je prépare les sacs une par une, selon leur maturité.`);
          const receipt = readReceipt() || {};
          receipt.announcedAt = nowIso();
          localStorage.setItem(GERMINATION_KEY, JSON.stringify(receipt));
        } catch (_) {}
      }

      global.render?.();
      return { total: seeds.length, growing: seeds.filter((seed) => seed.status === "growing").length };
    } finally {
      running = false;
    }
  }

  global.GerardGermination = { GERMINATION_KEY, germinateAll };

  void germinateAll();
  setTimeout(() => void germinateAll(), 800);
  setTimeout(() => void germinateAll(), 3000);
  window.addEventListener("focus", () => void germinateAll());
})(globalThis);
