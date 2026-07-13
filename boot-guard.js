(function bootGuard(global) {
  "use strict";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function collect() {
    const store = global.GardenStore?.snapshot?.() || {};
    const returns = global.AdventureReturnProcessor?.loadOutbox?.() || read("poulpe-fiction:adventure-return-outbox:v1", []);
    const runtime = global.GardenRuntime?.state?.record || read("poulpe-fiction:garden-runtime-cache:v1", null);
    return {
      parcels: Array.isArray(store.parcels) ? store.parcels : [],
      seeds: Array.isArray(store.seeds) ? store.seeds : [],
      operations: Array.isArray(store.operations) ? store.operations : [],
      harvests: Array.isArray(store.harvests) ? store.harvests : [],
      returns: Array.isArray(returns) ? returns : [],
      runtime,
    };
  }

  function render() {
    const root = document.getElementById("root");
    if (!root) return;
    const hasUsefulContent = root.children.length > 0 && root.textContent.trim().length > 30;
    if (hasUsefulContent) return;

    const data = collect();
    const returnedHarvests = data.returns.flatMap((bundle) => Array.isArray(bundle?.harvests) ? bundle.harvests : []);
    const harvestCount = data.harvests.length + returnedHarvests.length;
    const missionCount = data.operations.length + (data.runtime?.operationId ? 1 : 0);
    const currentActivity = data.runtime?.activity || "Le Garden est disponible. Gérard veille.";

    root.innerHTML = `
      <section class="garden-shell boot-guard" aria-label="Garden de Gérard">
        <nav class="shell-nav">
          <button class="active" type="button">Garden</button>
          <a href="https://octopus-engine.onrender.com/gardener" target="_blank" rel="noreferrer">Local technique</a>
          <a href="https://blacklace-publisher-web.onrender.com/greenhouse" target="_blank" rel="noreferrer">Publisher</a>
        </nav>

        <article class="shell-hero">
          <div class="shell-gerard">🐙</div>
          <div>
            <p class="eyebrow">Gérard maintenant</p>
            <h2>${esc(currentActivity)}</h2>
            <p>Le hublot de secours s’est ouvert parce que l’interface principale n’a pas terminé son démarrage.</p>
          </div>
        </article>

        <section class="shell-grid shell-stats">
          <article class="shell-card"><span>🗺️</span><strong>${data.parcels.length}</strong><p>parcelle(s)</p></article>
          <article class="shell-card"><span>🌱</span><strong>${data.seeds.length}</strong><p>graine(s)</p></article>
          <article class="shell-card"><span>🐙</span><strong>${missionCount}</strong><p>mission(s)</p></article>
          <article class="shell-card"><span>🌾</span><strong>${harvestCount}</strong><p>récolte(s)</p></article>
        </section>

        <section class="shell-card">
          <p class="eyebrow">État du système</p>
          <h3>Interface principale interrompue</h3>
          <p id="bootGuardError">Les données restent accessibles. Recharge la page après le prochain déploiement.</p>
        </section>
      </section>`;
  }

  global.addEventListener("error", (event) => {
    global.__POULPE_BOOT_ERROR__ = event?.message || "Erreur JavaScript";
    setTimeout(() => {
      render();
      const target = document.getElementById("bootGuardError");
      if (target && global.__POULPE_BOOT_ERROR__) target.textContent = global.__POULPE_BOOT_ERROR__;
    }, 0);
  });

  global.addEventListener("unhandledrejection", (event) => {
    global.__POULPE_BOOT_ERROR__ = event?.reason?.message || String(event?.reason || "Promesse rejetée");
    setTimeout(render, 0);
  });

  document.addEventListener("DOMContentLoaded", () => setTimeout(render, 500));
  setTimeout(render, 1200);
})(globalThis);
