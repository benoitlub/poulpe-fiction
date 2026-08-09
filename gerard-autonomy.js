(function gerardAutonomyModule(global) {
  "use strict";

  if (global.__gerardAutonomyStarted) return;
  global.__gerardAutonomyStarted = true;

  const STATE_KEY = "poulpe-fiction:gerard-autonomy:v2";
  const RETRY_DELAY_MS = 2 * 60 * 1000;
  // Gérard n'attend plus un clic humain pour reprendre une Seed déjà
  // récoltée : il itère tout seul, en visant chaque fois mieux que la
  // dernière fois (voir gerard-local-harvester.js). Le délai entre deux
  // itérations s'allonge à mesure qu'une Seed en accumule, pour ne pas
  // marteler Mistral/Publisher indéfiniment sur une graine que personne ne
  // regarde — pas une attente de validation, juste de la sobriété.
  const ITERATION_BASE_COOLDOWN_MS = 20 * 60 * 1000;
  const ITERATION_MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;
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
    return autonomy.tentacles[seedId] || (autonomy.tentacles[seedId] = { lastAttemptAt: null, lastStatus: "idle", lastError: null, iterations: 0 });
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

  // Publisher's Neon-backed Cron loop (worker.ts, runTentacleCycle) needs
  // the Seed catalog to keep working "sans relâche" even once this tab
  // closes. Pushed periodically rather than on every poll tick — it's
  // catalog metadata (title/objective/...), not a harvest result.
  const TENTACLE_SYNC_INTERVAL_MS = 10 * 60 * 1000;
  let lastTentacleSyncAt = 0;

  function syncTentacleCatalog() {
    if (Date.now() - lastTentacleSyncAt < TENTACLE_SYNC_INTERVAL_MS) return;
    lastTentacleSyncAt = Date.now();
    try {
      const snapshot = global.GardenStore?.snapshot?.() || {};
      const seeds = (snapshot.seeds || [])
        .filter((seed) => seed?.id && seed?.parcelId && seed?.title)
        .map((seed) => ({
          seedId: seed.id,
          parcelId: seed.parcelId,
          title: seed.title,
          objective: seed.objective || seed.content || "",
          firstHarvest: seed.firstHarvest || "",
          knowledgeSlug: seed.knowledgeSlug || "",
        }));
      if (seeds.length) void global.PublisherClient?.syncTentacles?.(seeds);
    } catch (_) {}
  }

  function retryAllowed(tentacle) {
    if (!tentacle.lastAttemptAt) return true;
    const elapsed = Date.now() - new Date(tentacle.lastAttemptAt).getTime();
    return !Number.isFinite(elapsed) || elapsed >= RETRY_DELAY_MS;
  }

  function iterationCooldownMs(iterations) {
    const doublings = Math.min(Math.max(iterations, 0), 5);
    return Math.min(ITERATION_BASE_COOLDOWN_MS * Math.pow(2, doublings), ITERATION_MAX_COOLDOWN_MS);
  }

  // A tentacle is never "done" — once it has a ready harvest it just waits
  // out its cooldown, then goes again for a better pass. No human click
  // required to unblock it.
  function iterationDue(draft, tentacle) {
    const bundle = global.AdventureReturnProcessor?.latestForDraft?.(draft.id);
    if (!bundle || bundle.status !== "ready" || !bundle.harvests?.length) return true;
    const producedAt = Date.parse(bundle.createdAt || "");
    if (!Number.isFinite(producedAt)) return true;
    return Date.now() - producedAt >= iterationCooldownMs(tentacle.iterations);
  }

  // Advances a single tentacle's draft. Several of these run concurrently
  // (see advance() below) — each seedId has its own in-flight guard and
  // retry timer so tentacles never block one another.
  async function advanceOne(draft) {
    const seedId = draft.curiosity?.id;
    if (!seedId || inFlightSeedIds.has(seedId)) return;

    const tentacle = tentacleState(seedId);

    // Self-heal: blacklace-parcel.js's ensureGerardCultivation() used to
    // stomp a Seed's public status back to "bag-ready" every ~15s even
    // after this tentacle had genuinely reached harvest-ready (fixed, but
    // that fix only stops *future* stomping — it does nothing for Seeds
    // already stuck from before the fix landed, and the next real
    // iteration could be hours away under cooldown). Reconcile on every
    // poll instead of waiting: if this tentacle's own bookkeeping says the
    // last attempt succeeded, the Seed's visible status should say so too,
    // immediately, regardless of the iteration/cooldown schedule.
    if (tentacle.lastStatus === "harvest-ready") {
      const currentSeed = activeSeedFor(draft);
      if (currentSeed && currentSeed.status !== "harvest-ready" && currentSeed.status !== "harvested" && currentSeed.status !== "composted") {
        patchSeed(draft, { status: "harvest-ready", autonomyStatus: "local-harvest-ready" });
        refresh();
      }
    }

    if (!iterationDue(draft, tentacle)) {
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
          "Validation automatique de Gérard : travail interne et actions externes autorisées sans attendre un signal humain, sur décision explicite du jardinier."
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
      tentacle.iterations = (tentacle.iterations || 0) + 1;
      patchSeed(workingDraft, {
        status: "harvest-ready",
        autonomyStatus: "local-harvest-ready",
        operationId: bundle.operationId || bundle.missionId || null,
        harvestedAt: bundle.createdAt || nowIso(),
        iterationCount: tentacle.iterations
      });
      if (tentacle.iterations > 1) {
        push(`🌱 « ${workingDraft.curiosity.title || workingDraft.curiosity.id} » vient d'avoir une nouvelle itération (n°${tentacle.iterations}), sans attendre de signal.`);
      }
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

    syncTentacleCatalog();

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
