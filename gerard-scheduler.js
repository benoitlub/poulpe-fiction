(function gerardSchedulerModule(global) {
  "use strict";

  const STORAGE_KEY = "poulpe-fiction:gerard-scheduler:v1";
  const TENTACLE_COUNT = 8;
  const TICK_MS = 12_000;
  const MAX_OFFLINE_MINUTES = 12 * 60;
  const BAG_THRESHOLD = 78;
  const TERMINAL = new Set(["adventure", "harvested", "composted"]);
  const TENTACLE_ROLES = [
    "observer",
    "relieur",
    "documentaliste",
    "comparateur",
    "cultivateur",
    "préparateur",
    "veilleur",
    "mémoire"
  ];

  let ticking = false;
  let timer = null;

  function nowIso() { return new Date().toISOString(); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function hasActiveUserInteraction() {
    const active = document.activeElement;
    if (!active || active === document.body) return false;
    return Boolean(
      active.matches?.("input, textarea, select, [contenteditable='true']") ||
      active.closest?.("form, [data-form-active], [data-mission-active], [data-harvest-detail]")
    );
  }

  function emptyState() {
    return {
      version: 2,
      cursor: 0,
      lastTickAt: null,
      totalTicks: 0,
      tentacles: Array.from({ length: TENTACLE_COUNT }, (_, index) => ({
        id: `tentacle-${index + 1}`,
        role: TENTACLE_ROLES[index],
        parcelId: null,
        seedId: null,
        action: "disponible",
        updatedAt: null
      }))
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return emptyState();
      return Object.assign(emptyState(), saved, {
        version: 2,
        tentacles: Array.isArray(saved.tentacles) && saved.tentacles.length === TENTACLE_COUNT
          ? saved.tentacles.map((tentacle, index) => Object.assign({}, emptyState().tentacles[index], tentacle))
          : emptyState().tentacles
      });
    } catch (_) {
      return emptyState();
    }
  }

  let scheduler = loadState();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduler));
  }

  function elapsedMinutes() {
    if (!scheduler.lastTickAt) return 1;
    const elapsed = (Date.now() - new Date(scheduler.lastTickAt).getTime()) / 60_000;
    if (!Number.isFinite(elapsed) || elapsed < 0) return 1;
    return clamp(elapsed, 0.2, MAX_OFFLINE_MINUTES);
  }

  function gardenSnapshot() {
    try {
      const snapshot = global.GardenStore?.snapshot?.();
      return snapshot && typeof snapshot === "object" ? snapshot : { parcels: [], seeds: [] };
    } catch (_) {
      return { parcels: [], seeds: [] };
    }
  }

  function eligibleSeeds() {
    const snapshot = gardenSnapshot();
    const archivedParcels = new Set((snapshot.parcels || []).filter((parcel) => parcel.archived).map((parcel) => parcel.id));
    let seeds = Array.isArray(snapshot.seeds) ? snapshot.seeds : [];

    // Compatibility fallback during first boot, before GardenStore receives the historical parcel.
    if (!seeds.length) seeds = global.BlacklaceParcel?.parcel?.seeds || [];

    return seeds
      .filter((seed) => seed?.id && !TERMINAL.has(seed.status) && !archivedParcels.has(seed.parcelId))
      .sort((a, b) => {
        const aMaturity = Number(a.maturity) || 0;
        const bMaturity = Number(b.maturity) || 0;
        const aScore = aMaturity + Math.max(0, 12 - Number(a.priority || 12));
        const bScore = bMaturity + Math.max(0, 12 - Number(b.priority || 12));
        return bScore - aScore;
      });
  }

  function parcelName(parcelId) {
    const snapshot = gardenSnapshot();
    return (snapshot.parcels || []).find((parcel) => parcel.id === parcelId)?.name || parcelId || "Jardin";
  }

  function actionFor(role, seed) {
    const actions = {
      observer: `observe ${seed.title}`,
      relieur: `relie les connaissances de ${seed.title}`,
      documentaliste: `range les sources de ${seed.title}`,
      comparateur: `compare les pistes de ${seed.title}`,
      cultivateur: `fait pousser ${seed.title}`,
      préparateur: `évalue le prochain sac de ${seed.title}`,
      veilleur: `surveille les signaux de ${seed.title}`,
      mémoire: `retient les apprentissages de ${seed.title}`
    };
    return actions[role] || `cultive ${seed.title}`;
  }

  function cultivate(seed, tentacle, minutes) {
    const timestamp = nowIso();
    const priorityBoost = clamp(13 - Number(seed.priority || 12), 1, 12) * 0.035;
    const roleBoost = tentacle.role === "cultivateur" ? 1.25 : tentacle.role === "préparateur" ? 1.1 : 1;
    const gain = clamp(minutes * (0.22 + priorityBoost) * roleBoost, 0.15, 8);
    const previousMaturity = Number(seed.maturity) || 8;
    const maturity = clamp(previousMaturity + gain, 0, 100);
    const patch = {
      status: seed.status === "bag-ready" ? "bag-ready" : (maturity < 28 ? "observing" : "growing"),
      maturity: Math.round(maturity * 10) / 10,
      knowledgeTouches: Math.max(0, Number(seed.knowledgeTouches) || 0) + 1,
      lastCultivatedAt: timestamp,
      lastTentacleId: tentacle.id,
      lastTentacleRole: tentacle.role,
      gardener: "gerard",
      plantedBy: "gerard",
      plantedAt: seed.plantedAt || timestamp
    };

    Object.assign(seed, patch);

    // Keep the historical in-memory parcel aligned while GardenStore remains the source of truth.
    const legacySeed = global.BlacklaceParcel?.parcel?.seeds?.find?.((item) => item.id === seed.id);
    if (legacySeed) Object.assign(legacySeed, patch);

    tentacle.parcelId = seed.parcelId || global.BlacklaceParcel?.PARCEL_ID || null;
    tentacle.seedId = seed.id;
    tentacle.action = actionFor(tentacle.role, seed);
    tentacle.updatedAt = timestamp;

    try { global.GardenStore?.updateSeed?.(seed.id, patch); } catch (_) {}
  }

  function createGardenDraft(seed) {
    const snapshot = gardenSnapshot();
    const parcel = (snapshot.parcels || []).find((item) => item.id === seed.parcelId) || null;
    const context = {
      parcelId: seed.parcelId,
      parcelName: parcel?.name || seed.parcelId || "Jardin de Gérard",
      seedId: seed.id,
      seedTitle: seed.title,
      objective: seed.objective || seed.content || "Faire progresser cette Seed",
      firstHarvest: seed.firstHarvest || "Une récolte concrète et exploitable",
      selectedAt: nowIso()
    };

    try { localStorage.setItem(global.BlacklaceParcel?.ACTIVE_SEED_KEY || "poulpe-fiction:blacklace-active-seed:v1", JSON.stringify(context)); } catch (_) {}
    try { global.GardenStore?.activateSeed?.(context.parcelId, context.seedId); } catch (_) {}

    const draft = global.AdventureDraft?.create?.({
      entry: { id: seed.id, title: seed.title || seed.id, count: Number(seed.knowledgeTouches || 1) },
      objective: context.objective,
      bag: [
        `la Seed plantée : ${context.seedTitle}`,
        `la parcelle : ${context.parcelName}`,
        `l'objectif réel : ${context.objective}`,
        `la première récolte attendue : ${context.firstHarvest}`,
        "les connaissances et ressources déjà conservées dans le Garden"
      ],
      picnic: [
        "Publisher pour préparer les outils et Knowledge Packs utiles",
        "quelques tokens Mistral si une rédaction riche est nécessaire"
      ],
      grafts: ["Publisher Curator", "Mistral"],
      limits: [
        "Aucune publication ni prise de contact sans validation explicite",
        "Produire d'abord des livrables prêts à relire",
        "Conserver les apprentissages au retour"
      ],
      note: `Gérard a cultivé cette Seed dans « ${context.parcelName} ». Première récolte visée : ${context.firstHarvest}.`
    });
    if (!draft) return null;

    const saved = global.AdventureDraft?.save?.(draft) || draft;
    try {
      global.GardenStore?.updateSeed?.(seed.id, {
        status: "bag-ready",
        bagPreparedAt: nowIso(),
        adventureDraftId: saved.id
      });
    } catch (_) {}
    return saved;
  }

  async function prepareMatureSeed(seeds) {
    if (hasActiveUserInteraction()) return;
    if (global.DepartureController?.isRunning?.()) return;
    const draft = global.AdventureDraft?.load?.();
    if (draft && draft.status !== "cancelled") return;

    const candidate = seeds
      .filter((seed) => seed.status === "growing" && Number(seed.maturity) >= BAG_THRESHOLD)
      .sort((a, b) => (Number(b.maturity) || 0) - (Number(a.maturity) || 0))[0];

    if (!candidate) return;
    const legacyParcelId = global.BlacklaceParcel?.PARCEL_ID;
    if (!candidate.parcelId || candidate.parcelId === legacyParcelId) {
      await global.BlacklaceParcel?.prepareSeedAdventure?.(candidate.id, { silent: true });
      return;
    }
    createGardenDraft(candidate);
  }

  function renderTentacles() {
    const host = document.querySelector(".blacklace-parcel .seed-life-summary") || document.querySelector(".garden-dashboard");
    if (!host) return;

    let panel = document.querySelector(".gerard-tentacles-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "gerard-tentacles-panel";
      host.insertAdjacentElement("afterend", panel);
    }

    const snapshot = gardenSnapshot();
    const seeds = snapshot.seeds || [];
    const active = scheduler.tentacles.filter((tentacle) => tentacle.seedId);
    const average = seeds.length
      ? Math.round(seeds.reduce((sum, seed) => sum + (Number(seed.maturity) || 0), 0) / seeds.length)
      : 0;

    const html = `
      <div class="tentacles-heading">
        <div><span class="eyebrow">🐙 Gérard travaille dans tout le Garden</span><strong>${active.length}/${TENTACLE_COUNT} tentacules actifs</strong></div>
        <span class="tentacles-average">${snapshot.parcels?.length || 0} parcelle(s) · maturité moyenne ${average}%</span>
      </div>
      <div class="tentacles-grid">
        ${scheduler.tentacles.map((tentacle) => {
          const seed = seeds.find((item) => item.id === tentacle.seedId && (!tentacle.parcelId || item.parcelId === tentacle.parcelId));
          const location = seed ? parcelName(seed.parcelId) : "";
          return `<div class="tentacle-chip${seed ? " active" : ""}"><span>${tentacle.id.replace("tentacle-", "T")}</span><div><strong>${tentacle.role}</strong><small>${seed ? `${tentacle.action} · ${location}` : "disponible"}</small></div></div>`;
        }).join("")}
      </div>`;

    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  async function tick() {
    if (ticking) return;
    const seeds = eligibleSeeds();
    if (!seeds.length) return;

    ticking = true;
    try {
      const minutes = elapsedMinutes();
      const start = scheduler.cursor % seeds.length;

      scheduler.tentacles.forEach((tentacle, index) => {
        const seed = seeds[(start + index) % seeds.length];
        if (seed) cultivate(seed, tentacle, minutes);
        else {
          tentacle.parcelId = null;
          tentacle.seedId = null;
          tentacle.action = "disponible";
          tentacle.updatedAt = nowIso();
        }
      });

      scheduler.cursor = (start + TENTACLE_COUNT) % seeds.length;
      scheduler.lastTickAt = nowIso();
      scheduler.totalTicks += 1;
      persist();

      const interacting = hasActiveUserInteraction();
      if (!interacting) {
        const active = global.GardenStore?.activeSeed?.() || global.BlacklaceParcel?.activeSeed?.();
        global.BlacklaceParcel?.syncGardenDomain?.(active);
        void global.BlacklaceParcel?.writeGlobalState?.(active);
        await prepareMatureSeed(seeds);
      }

      renderTentacles();
    } finally {
      ticking = false;
    }
  }

  function start() {
    if (timer) clearInterval(timer);
    void tick();
    timer = setInterval(() => void tick(), TICK_MS);
  }

  global.GerardScheduler = {
    STORAGE_KEY,
    TENTACLE_COUNT,
    snapshot: () => JSON.parse(JSON.stringify(scheduler)),
    eligibleSeeds: () => JSON.parse(JSON.stringify(eligibleSeeds())),
    tick,
    start,
    renderTentacles,
    hasActiveUserInteraction
  };

  start();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !hasActiveUserInteraction()) void tick();
  });
  global.addEventListener("load", () => global.setTimeout(renderTentacles, 0), { once: true });
})(globalThis);
