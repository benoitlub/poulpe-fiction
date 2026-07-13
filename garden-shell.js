(function gardenShellModule(global) {
  "use strict";

  const VIEW_KEY = "poulpe-fiction:main-view:v1";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function snapshot() {
    return global.GardenStore?.snapshot?.() || {
      parcels: [], seeds: [], operations: [], harvests: []
    };
  }

  function activeView() {
    return localStorage.getItem(VIEW_KEY) || "garden";
  }

  function setActiveView(view) {
    localStorage.setItem(VIEW_KEY, view);
    mount();
  }

  function events() {
    return global.ActivityEcho?.collectEvents?.() || [];
  }

  function renderActivities() {
    const items = events().slice(0, 8);
    if (!items.length) {
      return `<section class="shell-empty"><strong>Gérard veille.</strong><p>Aucune activité réelle n’est enregistrée pour le moment.</p></section>`;
    }
    return `<section class="shell-list">${items.map((item) => `
      <article>
        <span class="shell-dot ${esc(item.status || "calme")}"></span>
        <div><strong>${esc(item.label || item.type)}</strong>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</div>
      </article>`).join("")}</section>`;
  }

  function renderParcels(data) {
    const parcels = data.parcels || [];
    if (!parcels.length) return `<section class="shell-empty"><strong>Aucune parcelle visible.</strong><p>Le GardenStore ne contient encore aucune parcelle.</p></section>`;
    return `<section class="shell-grid">${parcels.map((parcel) => {
      const seeds = (data.seeds || []).filter((seed) => seed.parcelId === parcel.id).length;
      const ops = (data.operations || []).filter((operation) => operation.parcelId === parcel.id).length;
      return `<article class="shell-card"><p class="eyebrow">Parcelle</p><h3>${esc(parcel.name || parcel.title || parcel.id)}</h3><p>${seeds} graine(s) · ${ops} mission(s)</p></article>`;
    }).join("")}</section>`;
  }

  function renderMissions(data) {
    const operations = (data.operations || []).slice().sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    if (!operations.length) return `<section class="shell-empty"><strong>Aucune mission active.</strong><p>Les missions apparaîtront ici dès qu’Octopus Engine en recevra une.</p></section>`;
    return `<section class="shell-list">${operations.map((mission) => `
      <article>
        <span class="shell-status">${esc(mission.status || "inconnue")}</span>
        <div><strong>${esc(mission.intent || mission.activity || mission.id)}</strong><p>${esc(mission.obstacle?.message || mission.activity || "Mission Garden")}</p></div>
      </article>`).join("")}</section>`;
  }

  function renderGarden(data) {
    const harvests = data.harvests || [];
    const seeds = data.seeds || [];
    const operations = data.operations || [];
    const current = events()[0];
    return `<section class="shell-overview">
      <article class="shell-hero"><div class="shell-gerard">🐙</div><div><p class="eyebrow">Gérard maintenant</p><h2>${esc(current?.label || "Le jardin est calme. Gérard l’a décidé.")}</h2><p>${esc(current?.detail || "Gérard veille sans inventer de fausse activité.")}</p></div></article>
      <div class="shell-grid shell-stats">
        <article class="shell-card"><span>🌱</span><strong>${seeds.length}</strong><p>graine(s)</p></article>
        <article class="shell-card"><span>🐙</span><strong>${operations.length}</strong><p>mission(s)</p></article>
        <article class="shell-card"><span>🌾</span><strong>${harvests.length}</strong><p>récolte(s)</p></article>
        <article class="shell-card"><span>🗺️</span><strong>${(data.parcels || []).length}</strong><p>parcelle(s)</p></article>
      </div>
      <div class="shell-subsection"><h3>Activité réelle</h3>${renderActivities()}</div>
    </section>`;
  }

  function renderLocalTechnique() {
    const publisher = global.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-web.onrender.com/greenhouse";
    return `<section class="shell-grid">
      <a class="shell-card shell-link" href="https://octopus-engine.onrender.com/gardener" target="_blank" rel="noreferrer"><p class="eyebrow">Cerveau / moteur</p><h3>Octopus Engine</h3><p>État du moteur, missions et exécution.</p></a>
      <a class="shell-card shell-link" href="https://blacklace-publisher-web.onrender.com/greenhouse" target="_blank" rel="noreferrer"><p class="eyebrow">Yeux et oreilles</p><h3>Publisher</h3><p>Radar, Observatoire et signaux retenus.</p></a>
      <article class="shell-card"><p class="eyebrow">Connexion Publisher</p><h3>${esc(publisher)}</h3><p>URL actuellement utilisée par Poulpe Fiction.</p></article>
      <article class="shell-card"><p class="eyebrow">Stockage local</p><h3>GardenStore</h3><p>Parcelles, graines, missions et récoltes visibles sur cet appareil.</p></article>
    </section>`;
  }

  function renderView(view, data) {
    if (view === "activity") return renderActivities();
    if (view === "parcels") return renderParcels(data);
    if (view === "missions") return renderMissions(data);
    if (view === "technical") return renderLocalTechnique();
    return renderGarden(data);
  }

  function mount() {
    const root = document.getElementById("root");
    if (!root) return;
    const view = activeView();
    let shell = document.getElementById("gardenShell");
    const html = `<section id="gardenShell" class="garden-shell">
      <nav class="shell-nav" aria-label="Poulpe Fiction">
        ${[["garden","Garden"],["activity","Activité"],["parcels","Parcelles"],["missions","Missions"],["technical","Local technique"]].map(([id,label]) => `<button data-shell-view="${id}" class="${view === id ? "active" : ""}">${label}</button>`).join("")}
      </nav>
      <div class="shell-content">${renderView(view, snapshot())}</div>
    </section>`;
    if (shell) shell.outerHTML = html;
    else root.insertAdjacentHTML("afterbegin", html);
    shell = document.getElementById("gardenShell");
    shell?.querySelectorAll("[data-shell-view]").forEach((button) => {
      button.addEventListener("click", () => setActiveView(button.dataset.shellView || "garden"));
    });

    // L’ancien mode Survivor n’est plus la porte d’entrée.
    root.querySelectorAll(".survivor, .survivor-panel, .survivor-mode").forEach((node) => node.remove());
    const adventures = root.querySelector(".adventures-label");
    const objectiveGrid = adventures?.nextElementSibling;
    if (adventures) adventures.setAttribute("hidden", "");
    if (objectiveGrid?.classList.contains("grid")) objectiveGrid.setAttribute("hidden", "");
  }

  const baseRender = global.render;
  if (typeof baseRender === "function") {
    global.render = function renderWithGardenShell() {
      baseRender();
      global.GardenHublot?.mount?.();
      global.ActivityEcho?.mount?.();
      mount();
    };
  }

  global.GardenShell = { mount, setActiveView };
  mount();
})(globalThis);
