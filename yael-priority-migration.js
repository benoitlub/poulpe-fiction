(function yaelPriorityMigrationModule(global) {
  "use strict";
  const MIGRATION_KEY = "poulpe-fiction:migration:yael-priority:v1";
  const RECEIPT_KEY = "poulpe-fiction:adventure-departure:v1";
  const AUTONOMY_KEY = "poulpe-fiction:gerard-autonomy:v1";
  const YAEL_SEED_ID = "yael-prospection";

  function alreadyMigrated() {
    try { return localStorage.getItem(MIGRATION_KEY) === "done"; }
    catch (_) { return false; }
  }

  function resetAutonomy() {
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

  async function migrate() {
    if (alreadyMigrated()) return false;
    if (!global.YaelParcel?.install?.() || !global.BlacklaceParcel?.prepareSeedAdventure || !global.AdventureDraft) return false;

    const currentDraft = global.AdventureDraft.load?.();
    if (currentDraft?.curiosity?.id !== YAEL_SEED_ID) {
      try { global.AdventureDraft.save(null); } catch (_) {}
      try { localStorage.removeItem(RECEIPT_KEY); } catch (_) {}
    }

    resetAutonomy();
    const draft = global.BlacklaceParcel.prepareSeedAdventure(YAEL_SEED_ID, { silent: true });
    if (!draft) return false;

    try { localStorage.setItem(MIGRATION_KEY, "done"); } catch (_) {}
    try { global.pushChat?.("gerard", "🐙 J’ai rangé l’ancien dossier actif. La parcelle Yael devient prioritaire et sa récolte textuelle part sans Canva."); } catch (_) {}
    try { global.render?.(); } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
    global.setTimeout(() => void global.GerardAutonomy?.advance?.(), 250);
    return true;
  }

  global.YaelPriorityMigration = { MIGRATION_KEY, migrate };
  global.setTimeout(() => void migrate(), 300);
  global.addEventListener("load", () => global.setTimeout(() => void migrate(), 700), { once: true });
})(globalThis);
