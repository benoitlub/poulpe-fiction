(function greenhouseLiveBridgeModule(global) {
  "use strict";

  const RETRY_DELAYS = [1200, 5000, 15000];
  const LOADING_TEXT = "Gérard regarde vers la serre...";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [] };
  }

  function greenhouseNode() {
    return document.querySelector(".greenhouse");
  }

  function isStillLoading(node) {
    return Boolean(node && node.textContent?.includes(LOADING_TEXT));
  }

  function serverEvents() {
    try { return global.PersistentLifeSync?.events?.() || []; }
    catch (_) { return []; }
  }

  function liveSummary(server) {
    const local = snapshot();
    const seeds = Array.isArray(server?.seeds) && server.seeds.length ? server.seeds : (local.seeds || []);
    const events = Array.isArray(server?.events) && server.events.length ? server.events : serverEvents();
    const cultivated = seeds.filter((seed) => seed.runtime === "server" || seed.lastCultivatedAt);
    const latest = events[0] || null;
    const average = seeds.length
      ? Math.round((seeds.reduce((total, seed) => total + Number(seed.maturity || 0), 0) / seeds.length) * 10) / 10
      : 0;
    return { seeds, events, cultivated, latest, average };
  }

  function renderLive(server) {
    const node = greenhouseNode();
    if (!node) return;
    const summary = liveSummary(server || {});
    if (summary.seeds.length) {
      const latestLabel = summary.latest?.label || (summary.cultivated.length ? "Gérard cultive côté serveur." : "Les Seeds sont synchronisées.");
      node.innerHTML = `<div><p class="eyebrow">Serre Publisher · PostgreSQL</p><h2>🌿 Gérard cultive réellement.</h2><p>${summary.seeds.length} Seed(s) reliée(s) · maturité moyenne ${esc(summary.average)} %.</p><small>${esc(latestLabel)}</small></div>`;
      return;
    }
    node.innerHTML = `<div><p class="eyebrow">Serre Publisher · connexion active</p><h2>La serre répond, mais elle attend les Seeds.</h2><p>Gérard reste disponible. Une nouvelle synchronisation va être tentée automatiquement.</p></div><button class="ghost" id="forcePersistentLifeSync">Synchroniser maintenant</button>`;
    document.getElementById("forcePersistentLifeSync")?.addEventListener("click", () => void forceSync());
  }

  function renderUnavailable(message) {
    const node = greenhouseNode();
    if (!node || !isStillLoading(node)) return;
    node.innerHTML = `<div><p class="eyebrow">Serre Publisher</p><h2>La serre met trop de temps à répondre.</h2><p>${esc(message || "Gérard continue avec le Garden local et réessaiera plus tard.")}</p></div><button class="ghost" id="forcePersistentLifeSync">Réessayer</button>`;
    document.getElementById("forcePersistentLifeSync")?.addEventListener("click", () => void forceSync());
  }

  async function forceSync() {
    try {
      await global.PersistentLifeSync?.sync?.();
      await new Promise((resolve) => global.setTimeout(resolve, 500));
      renderLive({ seeds: snapshot().seeds || [], events: serverEvents() });
    } catch (error) {
      renderUnavailable(error instanceof Error ? error.message : "Synchronisation indisponible.");
    }
  }

  function install() {
    global.addEventListener?.("poulpe-life-sync", (event) => renderLive(event.detail || {}));
    RETRY_DELAYS.forEach((delay, index) => {
      global.setTimeout(async () => {
        try {
          await global.PersistentLifeSync?.sync?.();
          if (index === RETRY_DELAYS.length - 1 && isStillLoading(greenhouseNode())) {
            renderLive({ seeds: snapshot().seeds || [], events: serverEvents() });
          }
        } catch (error) {
          if (index === RETRY_DELAYS.length - 1) {
            renderUnavailable(error instanceof Error ? error.message : "Synchronisation indisponible.");
          }
        }
      }, delay);
    });
  }

  install();
  global.GreenhouseLiveBridge = { forceSync, renderLive, renderUnavailable };
})(globalThis);
