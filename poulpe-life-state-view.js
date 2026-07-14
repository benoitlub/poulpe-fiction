(function poulpeLifeStateView(global) {
  "use strict";

  const base = String(global.PoulpeRuntimeConfig?.urls?.publisherApi || "").replace(/\/$/, "");
  const endpoint = `${base}/api/poulpe-life/state`;
  let refreshTimer = null;

  function htmlEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function averageMaturity(seeds) {
    if (!seeds.length) return 0;
    return Math.round((seeds.reduce((sum, seed) => sum + Number(seed.maturity || 0), 0) / seeds.length) * 10) / 10;
  }

  function mergeServerSeeds(seeds) {
    seeds.forEach((seed) => {
      try {
        global.GardenStore?.updateSeed?.(seed.id, seed);
      } catch (_) {}
    });
  }

  async function fetchPersistentState() {
    if (!base) {
      state.greenhouse = { status: "unconfigured", data: null, error: null };
      render();
      return;
    }

    const controller = new AbortController();
    const timeout = global.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      const data = await response.json();
      const seeds = Array.isArray(data.seeds) ? data.seeds : [];
      const events = Array.isArray(data.events) ? data.events : [];
      const parcels = Array.isArray(data.parcels) ? data.parcels : [];
      mergeServerSeeds(seeds);
      state.greenhouse = {
        status: "ready",
        data: { source: "PostgreSQL", seeds, events, parcels, cuttings: [] },
        error: null,
      };
    } catch (error) {
      state.greenhouse = {
        status: "error",
        data: null,
        error: error?.name === "AbortError"
          ? "Publisher met trop de temps à répondre. Gérard continue côté serveur."
          : (error instanceof Error ? error.message : "Serre Publisher inaccessible"),
      };
    } finally {
      global.clearTimeout(timeout);
      render();
    }
  }

  loadGreenhouse = fetchPersistentState;

  renderGreenhouse = function renderPersistentGreenhouse() {
    const greenhouse = state.greenhouse || { status: "loading" };
    if (greenhouse.status === "loading") {
      return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher · PostgreSQL</p><h2>Connexion au jardin vivant…</h2><p>Lecture de l’activité réelle de Gérard.</p></div></section>`;
    }
    if (greenhouse.status === "unconfigured") {
      return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>Publisher n’est pas configuré</h2><p>L’adresse de l’API manque dans Poulpe-Fiction.</p></div></section>`;
    }
    if (greenhouse.status === "error") {
      return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher</p><h2>La fenêtre ne répond pas encore</h2><p>${htmlEscape(greenhouse.error)}</p><small>La culture serveur n’est pas arrêtée.</small></div><button class="ghost" id="reloadGreenhouse">Réessayer</button></section>`;
    }

    const seeds = Array.isArray(greenhouse.data?.seeds) ? greenhouse.data.seeds : [];
    const events = Array.isArray(greenhouse.data?.events) ? greenhouse.data.events : [];
    const latest = events[0];
    const average = averageMaturity(seeds);
    const growing = seeds.filter((seed) => ["observing", "growing"].includes(seed.status)).length;
    const ready = seeds.filter((seed) => seed.status === "bag-ready").length;

    if (!seeds.length) {
      return `<section class="greenhouse"><div><p class="eyebrow">Serre Publisher · PostgreSQL</p><h2>La base répond, mais aucune Seed n’est présente</h2><p>Le bootstrap serveur n’a pas encore alimenté le jardin.</p></div><button class="ghost" id="reloadGreenhouse">Actualiser</button></section>`;
    }

    return `<section class="greenhouse"><div class="greenhouse-head"><div><p class="eyebrow">Serre Publisher · PostgreSQL</p><h2>🌿 Gérard cultive réellement</h2><p>${seeds.length} Seed(s) persistante(s) · maturité moyenne ${htmlEscape(average)} %.</p></div><span>${events.length} événement${events.length > 1 ? "s" : ""}</span></div><div class="cuttings"><article class="cutting"><strong>En pousse</strong><p>${growing} Seed(s) observée(s) ou en croissance.</p><small>Le serveur travaille même quand Poulpe-Fiction est fermé.</small></article><article class="cutting"><strong>Sacs prêts</strong><p>${ready} Seed(s) prête(s) pour une aventure.</p><small>${latest ? htmlEscape(latest.label || "Dernière activité enregistrée") : "Première culture en cours"}</small></article><article class="cutting"><strong>Dernière trace</strong><p>${latest ? htmlEscape(latest.label || latest.kind || "Culture") : "Gérard vient de commencer."}</p><small>${latest?.createdAt ? htmlEscape(new Date(latest.createdAt).toLocaleString("fr-FR")) : ""}</small></article></div><button class="ghost" id="reloadGreenhouse">Actualiser la serre</button></section>`;
  };

  global.addEventListener?.("DOMContentLoaded", () => void fetchPersistentState(), { once: true });
  void fetchPersistentState();
  refreshTimer = global.setInterval(() => void fetchPersistentState(), 60000);
  global.addEventListener?.("pagehide", () => global.clearInterval(refreshTimer), { once: true });
})(globalThis);
