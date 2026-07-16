(function yaelPriorityMigrationModule(global) {
  "use strict";

  const MIGRATION_KEY = "poulpe-fiction:migration:yael-autostart:v2";
  const RECEIPT_KEY = "poulpe-fiction:adventure-departure:v1";
  const AUTONOMY_KEY = "poulpe-fiction:gerard-autonomy:v1";
  const YAEL_SEED_ID = "yael-prospection";
  const RETRY_MS = 1200;
  const MAX_ATTEMPTS = 12;
  let attempts = 0;
  let running = false;

  function done() {
    try { return localStorage.getItem(MIGRATION_KEY) === "done"; }
    catch (_) { return false; }
  }

  function markDone() {
    try { localStorage.setItem(MIGRATION_KEY, "done"); } catch (_) {}
  }

  function clearOldRuntime() {
    try { localStorage.removeItem(RECEIPT_KEY); } catch (_) {}
    try {
      const previous = JSON.parse(localStorage.getItem(AUTONOMY_KEY) || "null") || {};
      localStorage.setItem(AUTONOMY_KEY, JSON.stringify({
        ...previous,
        enabled: true,
        lastAttemptAt: null,
        lastDraftId: null,
        lastStatus: "idle",
        lastError: null,
        migratedFor: YAEL_SEED_ID,
        migratedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function receiptFor(draft) {
    try {
      const value = JSON.parse(localStorage.getItem(RECEIPT_KEY) || "null");
      return value?.adventureDraftId === draft?.id && value?.operationId ? value : null;
    } catch (_) { return null; }
  }

  async function launchYael() {
    if (running || done()) return false;
    running = true;
    attempts += 1;

    try {
      if (!global.YaelParcel?.install?.() || !global.BlacklaceParcel?.prepareSeedAdventure || !global.AdventureDraft || !global.AdventureLaunch?.launch) {
        throw new Error("runtime-not-ready");
      }

      let draft = global.AdventureDraft.load?.();
      if (draft?.curiosity?.id !== YAEL_SEED_ID) {
        try { global.AdventureDraft.save(null); } catch (_) {}
        clearOldRuntime();
        draft = global.BlacklaceParcel.prepareSeedAdventure(YAEL_SEED_ID, { silent: true });
      }

      if (!draft) throw new Error("yael-draft-missing");

      if (draft.status === "prepared") {
        draft = global.AdventureDraft.validate(
          draft,
          "Validation automatique du travail interne de Gérard. Publication, dépense, prise de contact et action externe restent soumises à validation humaine."
        );
      }

      try {
        global.GardenStore?.updateSeed?.(YAEL_SEED_ID, {
          status: "adventure",
          autonomyStatus: "launching",
          adventureDraftId: draft.id,
          autonomyUpdatedAt: new Date().toISOString()
        });
      } catch (_) {}

      try { global.pushChat?.("gerard", "🐙 La parcelle Yael est mûre. Je valide le travail interne et je pars produire la récolte textuelle sans attendre ton clic."); } catch (_) {}
      try { global.render?.(); } catch (_) {}
      try { global.GardenShell?.mount?.(); } catch (_) {}

      await global.AdventureLaunch.launch();

      const receipt = receiptFor(draft);
      if (!receipt) throw new Error("octopus-departure-not-confirmed");

      try {
        global.GardenStore?.updateSeed?.(YAEL_SEED_ID, {
          status: "adventure",
          autonomyStatus: "dispatched",
          operationId: receipt.operationId,
          missionId: receipt.missionId || null,
          departedAt: receipt.departedAt || new Date().toISOString()
        });
      } catch (_) {}

      markDone();
      try { global.pushChat?.("gerard", "🚀 Yael est partie vers Octopus. Je reviens avec une récolte textuelle exploitable."); } catch (_) {}
      try { global.render?.(); } catch (_) {}
      try { global.GardenShell?.mount?.(); } catch (_) {}
      return true;
    } catch (error) {
      if (attempts < MAX_ATTEMPTS) {
        global.setTimeout(() => void launchYael(), RETRY_MS);
      } else {
        try {
          global.GardenStore?.updateSeed?.(YAEL_SEED_ID, {
            status: "blocked",
            autonomyStatus: "blocked",
            autonomyError: error instanceof Error ? error.message : "autostart-failed"
          });
        } catch (_) {}
        try { global.pushChat?.("gerard", "⏸ Je n’ai pas réussi à lancer Yael automatiquement. Le bouton de départ reste disponible comme secours."); } catch (_) {}
      }
      return false;
    } finally {
      running = false;
    }
  }

  global.YaelPriorityMigration = { MIGRATION_KEY, launchYael };
  global.setTimeout(() => void launchYael(), 250);
  global.addEventListener("load", () => global.setTimeout(() => void launchYael(), 600), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void launchYael();
  });
})(globalThis);
