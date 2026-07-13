(function gardenShellModule(global) {
  "use strict";

  const VIEW_KEY = "poulpe-fiction:main-view:v1";
  const DEPARTURE_KEY = "poulpe-fiction:adventure-departure:v1";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [], operations: [], harvests: [] };
  }

  function activeView() { return localStorage.getItem(VIEW_KEY) || "garden"; }
  function setActiveView(view) { localStorage.setItem(VIEW_KEY, view); mount(); }
  function events() { return global.ActivityEcho?.collectEvents?.() || []; }
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; } }

  function renderActivities() {
    const items = events().slice(0, 8);
    if (!items.length) return `<section class="shell-empty"><strong>Gérard veille.</strong><p>Aucune activité réelle n’est enregistrée pour le moment.</p></section>`;
    return `<section class="shell-list">${items.map((item) => `<article><span class="shell-dot ${esc(item.status || "calme")}"></span><div><strong>${esc(item.label || item.type)}</strong>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</div></article>`).join("")}</section>`;
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

  function adventureState() {
    const draft = global.AdventureDraft?.load?.() || null;
    const receipt = readJson(DEPARTURE_KEY);
    const runtime = global.GardenRuntime?.state || {};
    const currentEvents = events();
    const mistralSeen = currentEvents.some((item) => /mistral/i.test(`${item.label || ""} ${item.detail || ""}`));
    const composioSeen = currentEvents.some((item) => /composio|canva|instagram|linkedin|tiktok/i.test(`${item.label || ""} ${item.detail || ""}`));
    return { draft, receipt, runtime, mistralSeen, composioSeen };
  }

  function stage(label, state, detail) {
    const icon = state === "done" ? "✓" : state === "active" ? "●" : state === "blocked" ? "!" : "○";
    return `<li class="journey-stage ${state}"><span>${icon}</span><div><strong>${esc(label)}</strong><p>${esc(detail)}</p></div></li>`;
  }

  function renderAdventureJourney() {
    const { draft, receipt, runtime, mistralSeen, composioSeen } = adventureState();
    const validated = draft?.status === "validated";
    const departed = Boolean(receipt?.departedAt || receipt?.operationId);
    const runtimeStatus = String(runtime?.record?.status || runtime?.status || receipt?.missionStatus || "");
    const waitingAuth = runtimeStatus === "waiting-authorization" || Boolean(runtime?.obstacle);
    const finished = ["ready", "completed", "success"].includes(runtimeStatus);
    const failed = ["failed", "blocked"].includes(runtimeStatus);

    const action = !draft
      ? `<button class="primary journey-action" id="journeyPrepare">🌱 Choisir une Seed et préparer un sac</button>`
      : !validated
        ? `<button class="primary journey-action" id="journeyPrepare">🎒 Finir et valider le sac</button>`
        : !departed
          ? `<button class="primary journey-action" id="journeyLaunch">🚶 Partir avec ce sac</button>`
          : waitingAuth
            ? `<button class="primary journey-action" id="journeyPublisher">🔑 Ouvrir les autorisations Publisher</button>`
            : `<button class="ghost journey-action" id="journeyRefresh">↻ Actualiser la mission</button>`;

    return `<section class="journey-card">
      <div class="journey-head"><div><p class="eyebrow">Chemin de l’aventure</p><h3>${esc(draft?.curiosity?.title || "Aucune aventure préparée")}</h3></div><span class="shell-status">${esc(runtimeStatus || (validated ? "sac prêt" : draft ? "préparation" : "à choisir"))}</span></div>
      <ol class="journey-stages">
        ${stage("Seed et sac", validated ? "done" : draft ? "active" : "pending", validated ? "Sac validé par Benoît." : draft ? "Le sac doit encore être validé." : "Choisis une Seed depuis la parcelle active.")}
        ${stage("Départ vers Octopus", departed ? "done" : validated ? "active" : "pending", departed ? `Mission ${receipt?.operationId || receipt?.missionId || "envoyée"}.` : "Le départ crée une vraie mission distante.")}
        ${stage("Génération Mistral", mistralSeen || departed ? (finished ? "done" : "active") : "pending", departed ? "Mistral rédige le livrable demandé, sans inventer de données." : "Mistral sera autorisé par le sac.")}
        ${stage("Action Composio", composioSeen || waitingAuth ? (waitingAuth ? "blocked" : "active") : "pending", waitingAuth ? "Une autorisation humaine est nécessaire dans Publisher." : "Composio intervient seulement pour les actions externes autorisées.")}
        ${stage("Récolte", finished ? "done" : failed ? "blocked" : "pending", finished ? "Le retour est prêt à être examiné." : failed ? "La mission a rencontré un blocage conservé dans le journal." : "La récolte apparaîtra après le retour réel.")}
      </ol>
      ${action}
    </section>`;
  }

  function renderMissions(data) {
    const operations = (data.operations || []).slice().sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const list = operations.length ? `<section class="shell-list">${operations.map((mission) => `<article><span class="shell-status">${esc(mission.status || "inconnue")}</span><div><strong>${esc(mission.intent || mission.activity || mission.id)}</strong><p>${esc(mission.obstacle?.message || mission.activity || "Mission Garden")}</p></div></article>`).join("")}</section>` : `<section class="shell-empty"><strong>Aucune mission enregistrée dans GardenStore.</strong><p>Le parcours ci-dessus reste utilisable et affiche aussi le reçu de départ et l’état distant.</p></section>`;
    return `${renderAdventureJourney()}${list}`;
  }

  function renderGarden(data) {
    const harvests = data.harvests || [], seeds = data.seeds || [], operations = data.operations || [];
    return `<section class="shell-overview shell-overview-compact"><div class="shell-grid shell-stats"><article class="shell-card"><span>🌱</span><strong>${seeds.length}</strong><p>graine(s)</p></article><article class="shell-card"><span>🐙</span><strong>${operations.length}</strong><p>mission(s)</p></article><article class="shell-card"><span>🌾</span><strong>${harvests.length}</strong><p>récolte(s)</p></article><article class="shell-card"><span>🗺️</span><strong>${(data.parcels || []).length}</strong><p>parcelle(s)</p></article></div></section>`;
  }

  function renderLocalTechnique() {
    const publisher = global.PUBLISHER_API_URL || localStorage.getItem("PUBLISHER_API_URL") || "https://blacklace-publisher-web.onrender.com/greenhouse";
    return `<section class="shell-grid"><a class="shell-card shell-link" href="https://octopus-engine.onrender.com/gardener" target="_blank" rel="noreferrer"><p class="eyebrow">Cerveau / moteur</p><h3>Octopus Engine</h3><p>État du moteur, missions et exécution.</p></a><a class="shell-card shell-link" href="https://blacklace-publisher-web.onrender.com/connectors" target="_blank" rel="noreferrer"><p class="eyebrow">Yeux, outils et autorisations</p><h3>Publisher · Local technique</h3><p>Mistral, Composio et comptes externes.</p></a><article class="shell-card"><p class="eyebrow">Connexion Publisher</p><h3>${esc(publisher)}</h3><p>URL actuellement utilisée par Poulpe Fiction.</p></article></section>`;
  }

  function renderView(view, data) {
    if (view === "activity") return renderActivities();
    if (view === "parcels") return renderParcels(data);
    if (view === "missions") return renderMissions(data);
    if (view === "technical") return renderLocalTechnique();
    return renderGarden(data);
  }

  function setVisible(selector, visible) { document.querySelectorAll(selector).forEach((node) => node.toggleAttribute("hidden", !visible)); }
  function applyViewVisibility(view) {
    setVisible(".garden-hublot", view === "garden");
    setVisible(".activity-echo", view === "activity");
    setVisible(".garden-primary", view === "garden" || view === "parcels");
    setVisible(".garden-runtime", view === "missions");
    setVisible(".gerard-chat", view === "garden");
    setVisible(".greenhouse", view === "garden");
    setVisible(".production-pack, .panel, .survivor, .survivor-panel, .survivor-mode", false);
  }

  function bindJourneyActions() {
    document.getElementById("journeyPrepare")?.addEventListener("click", () => {
      setActiveView("garden");
      setTimeout(() => document.querySelector(".greenhouse, .garden-primary")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    });
    document.getElementById("journeyLaunch")?.addEventListener("click", async () => {
      const button = document.getElementById("journeyLaunch");
      if (button) { button.disabled = true; button.textContent = "🐙 Départ en cours…"; }
      await global.AdventureLaunch?.launch?.();
      setTimeout(mount, 100);
    });
    document.getElementById("journeyPublisher")?.addEventListener("click", () => window.open("https://blacklace-publisher-web.onrender.com/connectors", "_blank", "noopener,noreferrer"));
    document.getElementById("journeyRefresh")?.addEventListener("click", () => { global.GardenRuntime?.refresh?.(); setTimeout(mount, 300); });
  }

  function mount() {
    const root = document.getElementById("root");
    if (!root) return;
    const view = activeView();
    let shell = document.getElementById("gardenShell");
    const html = `<section id="gardenShell" class="garden-shell" data-active-view="${esc(view)}"><nav class="shell-nav" aria-label="Poulpe Fiction">${[["garden","Hublot"],["activity","Activité"],["parcels","Parcelles"],["missions","Missions"],["technical","Local technique"]].map(([id,label]) => `<button data-shell-view="${id}" class="${view === id ? "active" : ""}">${label}</button>`).join("")}</nav><div class="shell-content">${renderView(view, snapshot())}</div></section>`;
    if (shell) shell.outerHTML = html; else root.insertAdjacentHTML("afterbegin", html);
    shell = document.getElementById("gardenShell");
    shell?.querySelectorAll("[data-shell-view]").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.shellView || "garden")));
    const adventures = root.querySelector(".adventures-label"), objectiveGrid = adventures?.nextElementSibling;
    if (adventures) adventures.setAttribute("hidden", "");
    if (objectiveGrid?.classList.contains("grid")) objectiveGrid.setAttribute("hidden", "");
    applyViewVisibility(view);
    bindJourneyActions();
  }

  const baseRender = global.render;
  if (typeof baseRender === "function") global.render = function renderWithGardenShell() { baseRender(); global.GardenHublot?.mount?.(); global.ActivityEcho?.mount?.(); mount(); };
  global.GardenShell = { mount, setActiveView };
  mount();
})(globalThis);
