(function gerardAutonomyModule(global) {
  "use strict";

  if (global.__gerardAutonomyStarted) return;
  global.__gerardAutonomyStarted = true;

  const STATE_KEY = "poulpe-fiction:gerard-autonomy:v2";
  const RETRY_DELAY_MS = 2 * 60 * 1000;
  const POLL_MS = 5_000;
  const MAX_CONCURRENT_TENTACLES = 8;
  const inFlightSeedIds = new Set();
  let timer = null;

  function nowIso() { return new Date().toISOString(); }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      return saved && typeof saved === "object"
        ? { enabled: saved.enabled !== false, tentacles: (saved.tentacles && typeof saved.tentacles === "object") ? saved.tentacles : {} }
        : { enabled: true, tentacles: {} };
    } catch (_) {
      return { enabled: true, tentacles: {} };
    }
  }

  let autonomy = loadState();

  function persist() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(autonomy)); } catch (_) {}
  }

  // One tentacle = one Seed being cultivated. Each keeps its own retry/error
  // state so a blocked tentacle never stalls the others.
  function tentacleState(seedId) {
    return autonomy.tentacles[seedId] || (autonomy.tentacles[seedId] = { lastAttemptAt: null, lastStatus: "idle", lastError: null });
  }

  function activeSeedFor(draft) {
    try {
      const snapshot = global.GardenStore?.snapshot?.() || {};
      return (snapshot.seeds || []).find((seed) => seed.id === draft?.curiosity?.id) || null;
    } catch (_) {
      return null;
    }
  }

  function patchSeed(draft, patch) {
    const seed = activeSeedFor(draft);
    if (!seed?.id) return;
    try { global.GardenStore?.updateSeed?.(seed.id, Object.assign({ autonomyUpdatedAt: nowIso() }, patch)); } catch (_) {}
  }

  function push(message) {
    try { global.pushChat?.("gerard", message); } catch (_) {}
  }

  function refresh() {
    try { if (typeof global.render === "function") global.render(); } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
  }

  function retryAllowed(tentacle) {
    if (!tentacle.lastAttemptAt) return true;
    const elapsed = Date.now() - new Date(tentacle.lastAttemptAt).getTime();
    return !Number.isFinite(elapsed) || elapsed >= RETRY_DELAY_MS;
  }

  function alreadyCompleted(draft) {
    const bundle = global.AdventureReturnProcessor?.latestForDraft?.(draft.id);
    return Boolean(bundle?.status === "ready" && bundle?.harvests?.length);
  }

  // Advances a single tentacle's draft. Several of these run concurrently
  // (see advance() below) — each seedId has its own in-flight guard and
  // retry timer so tentacles never block one another.
  async function advanceOne(draft) {
    const seedId = draft.curiosity?.id;
    if (!seedId || inFlightSeedIds.has(seedId)) return;

    const tentacle = tentacleState(seedId);

    if (alreadyCompleted(draft)) {
      tentacle.lastStatus = "harvest-ready";
      tentacle.lastError = null;
      persist();
      return;
    }
    if (!retryAllowed(tentacle)) return;

    if (!global.GerardLocalHarvester?.harvest) {
      tentacle.lastStatus = "waiting-local-runtime";
      persist();
      return;
    }

    inFlightSeedIds.add(seedId);
    tentacle.lastAttemptAt = nowIso();
    tentacle.lastError = null;

    try {
      let workingDraft = draft;
      if (workingDraft.status === "prepared") {
        workingDraft = global.AdventureDraft.validate(
          workingDraft,
          "Validation automatique de Gérard pour le travail interne. Toute dépense, publication, prise de contact ou action externe reste soumise à validation humaine."
        );
        global.AdventureDraft.saveBySeed?.(workingDraft);
        patchSeed(workingDraft, {
          status: "mission-queued",
          autonomyStatus: "validated",
          adventureDraftId: workingDraft.id
        });
        push(`🐙 « ${workingDraft.curiosity.title || workingDraft.curiosity.id} » est mûre. Je travaille localement sans te demander de porter mon sac.`);
      }

      tentacle.lastStatus = "harvesting-locally";
      persist();
      patchSeed(workingDraft, { status: "adventure", autonomyStatus: "harvesting-locally" });
      refresh();

      const bundle = await global.GerardLocalHarvester.harvest(workingDraft, "autonomous-local-first");
      if (!bundle?.harvests?.length) throw new Error("La récolte locale est revenue vide.");

      tentacle.lastStatus = "harvest-ready";
      tentacle.lastError = null;
      patchSeed(workingDraft, {
        status: "harvest-ready",
        autonomyStatus: "local-harvest-ready",
        operationId: bundle.operationId || bundle.missionId || null,
        harvestedAt: bundle.createdAt || nowIso()
      });
    } catch (error) {
      tentacle.lastStatus = "blocked";
      tentacle.lastError = error instanceof Error ? error.message : "Blocage inconnu";
      patchSeed(draft, {
        status: "blocked",
        autonomyStatus: "blocked",
        autonomyError: tentacle.lastError
      });
      push(`⏸ « ${draft.curiosity.title || draft.curiosity.id} » est bloquée localement : ${tentacle.lastError}`);
    } finally {
      inFlightSeedIds.delete(seedId);
      persist();
      refresh();
    }
  }

  // Gérard est un poulpe : chaque tentacule (Seed avec un AdventureDraft
  // actif) avance en parallèle, indépendamment des autres.
  async function advance() {
    if (!autonomy.enabled) return;
    if (global.GerardScheduler?.hasActiveUserInteraction?.()) return;
    if (global.DepartureController?.isRunning?.() || global.AdventureLaunch?.isLaunching?.()) return;

    const drafts = (global.AdventureDraft?.loadActiveDrafts?.() || []).slice(0, MAX_CONCURRENT_TENTACLES);
    if (!drafts.length) return;

    await Promise.all(drafts.map((draft) => advanceOne(draft)));
  }

  function setEnabled(enabled) {
    autonomy.enabled = Boolean(enabled);
    persist();
    if (autonomy.enabled) void advance();
    return autonomy.enabled;
  }

  function start() {
    if (timer) clearInterval(timer);
    void advance();
    timer = setInterval(() => void advance(), POLL_MS);
  }

  global.GerardAutonomy = {
    STATE_KEY,
    snapshot: () => JSON.parse(JSON.stringify(autonomy)),
    advance,
    start,
    setEnabled,
    isEnabled: () => Boolean(autonomy.enabled),
    isRunning: () => inFlightSeedIds.size > 0,
    activeTentacles: () => inFlightSeedIds.size
  };

  start();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void advance();
  });
  global.addEventListener("load", () => global.setTimeout(() => void advance(), 750), { once: true });
})(globalThis);
