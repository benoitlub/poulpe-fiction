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
      version: 1,
      cursor: 0,
      lastTickAt: null,
      totalTicks: 0,
      tentacles: Array.from({ length: TENTACLE_COUNT }, (_, index) => ({
        id: `tentacle-${index + 1}`,
        role: TENTACLE_ROLES[index],
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
        tentacles: Array.isArray(saved.tentacles) && saved.tentacles.length === TENTACLE_COUNT
          ? saved.tentacles
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

  function eligibleSeeds() {
    const seeds = global.BlacklaceParcel?.parcel?.seeds;
    if (!Array.isArray(seeds)) return [];
    return seeds
      .filter((seed) => !TERMINAL.has(seed.status))
      .sort((a, b) => {
        const aMaturity = Number(a.maturity) || 0;
        const bMaturity = Number(b.maturity) || 0;
        const aScore = aMaturity + Math.max(0, 12 - Number(a.priority || 12));
        const bScore = bMaturity + Math.max(0, 12 - Number(b.priority || 12));
        return bScore - aScore;
      });
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

    seed.maturity = Math.round(maturity * 10) / 10;
    seed.knowledgeTouches = Math.max(0, Number(seed.knowledgeTouches) || 0) + 1;
    seed.lastCultivatedAt = timestamp;
    seed.lastTentacleId = tentacle.id;
    seed.lastTentacleRole = tentacle.role;
    seed.gardener = "gerard";
    seed.plantedBy = "gerard";
    seed.plantedAt = seed.plantedAt || timestamp;

    if (!["bag-ready"].includes(seed.status)) {
      seed.status = maturity < 28 ? "observing" : "growing";
    }

    tentacle.seedId = seed.id;
    tentacle.action = actionFor(tentacle.role, seed);
    tentacle.updatedAt = timestamp;

    try {
      global.GardenStore?.updateSeed?.(seed.id, {
        status: seed.status,
        maturity: seed.maturity,
        knowledgeTouches: seed.knowledgeTouches,
        lastCultivatedAt: timestamp,
        lastTentacleId: tentacle.id,
        lastTentacleRole: tentacle.role,
        gardener: "gerard",
        plantedBy: "gerard",
        plantedAt: seed.plantedAt
      });
    } catch (_) {}
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
    await global.BlacklaceParcel?.prepareSeedAdventure?.(candidate.id, { silent: true });
  }

  function renderTentacles() {
    const host = document.querySelector(".blacklace-parcel .seed-life-summary");
    if (!host) return;

    let panel = document.querySelector(".gerard-tentacles-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "gerard-tentacles-panel";
      host.insertAdjacentElement("afterend", panel);
    }

    const seeds = global.BlacklaceParcel?.parcel?.seeds || [];
    const active = scheduler.tentacles.filter((tentacle) => tentacle.seedId);
    const average = seeds.length
      ? Math.round(seeds.reduce((sum, seed) => sum + (Number(seed.maturity) || 0), 0) / seeds.length)
      : 0;

    const html = `
      <div class="tentacles-heading">
        <div><span class="eyebrow">🐙 Gérard travaille en parallèle</span><strong>${active.length}/${TENTACLE_COUNT} tentacules actifs</strong></div>
        <span class="tentacles-average">Maturité moyenne ${average}%</span>
      </div>
      <div class="tentacles-grid">
        ${scheduler.tentacles.map((tentacle) => {
          const seed = seeds.find((item) => item.id === tentacle.seedId);
          return `<div class="tentacle-chip${seed ? " active" : ""}"><span>${tentacle.id.replace("tentacle-", "T")}</span><div><strong>${tentacle.role}</strong><small>${seed ? tentacle.action : "disponible"}</small></div></div>`;
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
        global.BlacklaceParcel?.syncGardenDomain?.(global.BlacklaceParcel?.activeSeed?.());
        void global.BlacklaceParcel?.writeGlobalState?.(global.BlacklaceParcel?.activeSeed?.());
        await prepareMatureSeed(seeds);
      }

      // A scheduler tick only updates its own isolated panel.
      // Forms, mission tracking and harvest details must never be remounted here.
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
