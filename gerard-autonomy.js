(function gerardAutonomyModule(global) {
  "use strict";

  if (global.__gerardAutonomyStarted) return;
  global.__gerardAutonomyStarted = true;

  const STATE_KEY = "poulpe-fiction:gerard-autonomy:v1";
  const RETRY_DELAY_MS = 2 * 60 * 1000;
  const POLL_MS = 5_000;
  let inFlight = false;
  let timer = null;

  function nowIso() { return new Date().toISOString(); }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      return saved && typeof saved === "object"
        ? Object.assign({ enabled: true, lastAttemptAt: null, lastDraftId: null, lastStatus: "idle", lastError: null }, saved)
        : { enabled: true, lastAttemptAt: null, lastDraftId: null, lastStatus: "idle", lastError: null };
    } catch (_) {
      return { enabled: true, lastAttemptAt: null, lastDraftId: null, lastStatus: "idle", lastError: null };
    }
  }

  let autonomy = loadState();

  function persist() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(autonomy)); } catch (_) {}
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

  function retryAllowed(draft) {
    if (autonomy.lastDraftId !== draft.id || !autonomy.lastAttemptAt) return true;
    const elapsed = Date.now() - new Date(autonomy.lastAttemptAt).getTime();
    return !Number.isFinite(elapsed) || elapsed >= RETRY_DELAY_MS;
  }

  function alreadyCompleted(draft) {
    const bundle = global.AdventureReturnProcessor?.latestForDraft?.(draft.id);
    return Boolean(bundle?.status === "ready" && bundle?.harvests?.length);
  }

  async function advance() {
    if (!autonomy.enabled || inFlight) return;
    if (global.GerardScheduler?.hasActiveUserInteraction?.()) return;
    if (global.DepartureController?.isRunning?.() || global.AdventureLaunch?.isLaunching?.()) return;

    let draft = global.AdventureDraft?.load?.();
    if (!draft || draft.status === "cancelled") return;
    if (alreadyCompleted(draft)) {
      autonomy.lastDraftId = draft.id;
      autonomy.lastStatus = "harvest-ready";
      autonomy.lastError = null;
      persist();
      return;
    }
    if (!retryAllowed(draft)) return;

    if (!global.GerardLocalHarvester?.harvest) {
      autonomy.lastStatus = "waiting-local-runtime";
      persist();
      return;
    }

    inFlight = true;
    autonomy.lastDraftId = draft.id;
    autonomy.lastAttemptAt = nowIso();
    autonomy.lastError = null;

    try {
      if (draft.status === "prepared") {
        draft = global.AdventureDraft.validate(
          draft,
          "Validation automatique de Gérard pour le travail interne. Toute dépense, publication, prise de contact ou action externe reste soumise à validation humaine."
        );
        patchSeed(draft, {
          status: "mission-queued",
          autonomyStatus: "validated",
          adventureDraftId: draft.id
        });
        push(`🐙 « ${draft.curiosity.title || draft.curiosity.id} » est mûre. Je travaille localement sans te demander de porter mon sac.`);
      }

      autonomy.lastStatus = "harvesting-locally";
      persist();
      patchSeed(draft, { status: "adventure", autonomyStatus: "harvesting-locally" });
      refresh();

      const bundle = await global.GerardLocalHarvester.harvest(draft, "autonomous-local-first");
      if (!bundle?.harvests?.length) throw new Error("La récolte locale est revenue vide.");

      autonomy.lastStatus = "harvest-ready";
      autonomy.lastError = null;
      patchSeed(draft, {
        status: "harvest-ready",
        autonomyStatus: "local-harvest-ready",
        operationId: bundle.operationId || bundle.missionId || null,
        harvestedAt: bundle.createdAt || nowIso()
      });
    } catch (error) {
      autonomy.lastStatus = "blocked";
      autonomy.lastError = error instanceof Error ? error.message : "Blocage inconnu";
      patchSeed(draft, {
        status: "blocked",
        autonomyStatus: "blocked",
        autonomyError: autonomy.lastError
      });
      push(`⏸ « ${draft.curiosity.title || draft.curiosity.id} » est bloquée localement : ${autonomy.lastError}`);
    } finally {
      inFlight = false;
      persist();
      refresh();
    }
  }

  function setEnabled(enabled) {
    autonomy.enabled = Boolean(enabled);
    autonomy.lastError = null;
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
    isRunning: () => inFlight
  };

  start();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void advance();
  });
  global.addEventListener("load", () => global.setTimeout(() => void advance(), 750), { once: true });
})(globalThis);
