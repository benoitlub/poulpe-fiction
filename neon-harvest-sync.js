(function neonHarvestSyncModule(global) {
  "use strict";

  // Mirrors Publisher's Neon-backed tentacle loop into the Garden the user
  // actually looks at. Without this, that whole server-side loop (real
  // Mistral text + Canva visuals, running via Cloudflare Cron independent
  // of any browser tab) produces genuine work that's simply never seen —
  // exactly what was happening until this module existed.
  const IMPORTED_KEY = "poulpe-fiction:neon-harvest-sync:v1";
  const SYNC_INTERVAL_MS = 60 * 1000;

  const text = (value) => typeof value === "string" ? value.trim() : "";

  function importedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(IMPORTED_KEY) || "[]")); }
    catch (_) { return new Set(); }
  }

  function saveImported(set) {
    try { localStorage.setItem(IMPORTED_KEY, JSON.stringify([...set].slice(-500))); } catch (_) {}
  }

  function harvestContent(iteration) {
    const body = text(iteration.content);
    const visualUrl = text(iteration.visual_url);
    if (body && visualUrl) return `${body}\n\n## Visuel créé par Gérard\n[Voir le visuel Canva](${visualUrl})`;
    if (body) return body;
    if (visualUrl) return `Un visuel a été créé par Gérard, sans texte cette fois : ${visualUrl}`;
    return "";
  }

  async function sync() {
    const payload = await global.PublisherClient?.get?.("/api/tentacles/iterations?limit=200");
    const iterations = Array.isArray(payload?.iterations) ? payload.iterations : [];
    if (!iterations.length) return;

    const seen = importedIds();
    let changed = false;

    for (const iteration of iterations) {
      const seedId = text(iteration.seed_id);
      const iterationId = iteration.id;
      if (!seedId || !iterationId) continue;
      const harvestId = `neon_iter_${iterationId}`;
      if (seen.has(harvestId)) continue;

      const content = harvestContent(iteration);
      if (!content) { seen.add(harvestId); continue; }

      const modeLabel = iteration.mode === "play" ? " · exploration" : "";
      const title = `☁️ Récolte serveur · ${text(iteration.title) || seedId} (itération ${iteration.iteration_number}${modeLabel})`;

      try {
        global.GardenStore?.addHarvest?.({
          id: harvestId,
          parcelId: text(iteration.parcel_id) || undefined,
          seedId,
          operationId: harvestId,
          title,
          content,
          url: text(iteration.visual_url) || undefined,
          type: "text/markdown",
          createdAt: iteration.created_at,
        });
        // Only ever moves a Seed *forward* to harvest-ready — never
        // regresses one that's already further along locally.
        if (global.BlacklaceParcel?.updateSeedStatus) {
          global.BlacklaceParcel.updateSeedStatus(seedId, "harvest-ready", { autonomyStatus: "server-harvest-ready" });
        }
        seen.add(harvestId);
        changed = true;
      } catch (_) { /* skip this one, retry next sync tick */ }
    }

    if (changed) {
      saveImported(seen);
      try { global.pushChat?.("gerard", "☁️ Le travail que j’ai fait côté serveur (sans que ton téléphone soit ouvert) vient d’arriver dans le Garden."); } catch (_) {}
    } else {
      saveImported(seen);
    }
  }

  global.NeonHarvestSync = { sync };

  void sync();
  global.setInterval(() => void sync(), SYNC_INTERVAL_MS);
})(globalThis);
