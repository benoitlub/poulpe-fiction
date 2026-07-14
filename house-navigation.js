(function houseNavigationModule(global) {
  "use strict";

  const PROJECTS_KEY = "poulpe-fiction:client-projects:v1";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function access() {
    return global.PoulpeAccess?.snapshot?.() || { mode: "owner", parcelId: null };
  }

  function data() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [], operations: [], harvests: [] };
  }

  function publisherUrl(path) {
    const base = global.PoulpeRuntimeConfig?.urls?.publisherFrontend || "https://blacklace-publisher-web.onrender.com";
    return global.PoulpeAccess?.scopedUrl?.(base, path || "/") || `${base}${path || "/"}`;
  }

  function parcelLabel(snapshot, context) {
    if (context.mode === "owner") return `${snapshot.parcels.length} parcelle(s) visible(s)`;
    const parcel = snapshot.parcels.find((item) => item.id === context.parcelId);
    return parcel?.name || context.parcelId || "Parcelle client";
  }

  function renderHome() {
    const context = access();
    const snapshot = data();
    const client = context.mode === "client";
    const currentParcel = snapshot.parcels.find((item) => item.id === context.parcelId);

    return `<section class="access-home" id="houseHome">
      <div class="access-scope">
        <div>
          <small>${client ? "Accès client" : "Accès propriétaire"}</small>
          <strong>${esc(parcelLabel(snapshot, context))}</strong>
        </div>
        ${client ? "" : `<button type="button" class="ghost" id="houseOwnerAll">Toutes les parcelles</button>`}
      </div>
      <div class="access-hero">
        <p class="eyebrow">${client ? "Votre projet" : "Maison de Gérard"}</p>
        <h2>${client ? esc(currentParcel?.name || "Votre parcelle") : "Que voulez-vous cultiver ?"}</h2>
        <p>${client
          ? "Parlez à Gérard, suivez la croissance de votre projet et examinez les récoltes. Les outils techniques restent derrière le décor."
          : "Ajoutez un projet, ouvrez une parcelle ou regardez ce que Gérard fait pousser dans tout l’écosystème."}</p>
      </div>
      <div class="access-actions">
        ${client ? "" : `<button class="access-action primary" id="houseNewProject"><strong>➕ Ajouter un projet</strong><small>Décrire simplement le projet ; Gérard préparera la parcelle.</small></button>`}
        <button class="access-action primary" data-house-view="garden"><strong>🌿 Voir le Garden</strong><small>${client ? "Suivre votre parcelle" : "Voir toutes les parcelles et leur maturité"}.</small></button>
        <button class="access-action" data-house-view="missions"><strong>🐙 Suivre le travail</strong><small>Voir les actions décidées, les influx envoyés et les récoltes.</small></button>
        <a class="access-action" href="${esc(publisherUrl("/"))}" target="_blank" rel="noreferrer"><strong>🔭 Ouvrir l’Observatoire</strong><small>${client ? "Voir les connaissances préparées pour ce projet" : "Observer les sources, Knowledge Packs et opportunités"}.</small></a>
        ${client ? "" : `<a class="access-action" href="${esc(publisherUrl("/local-technique"))}" target="_blank" rel="noreferrer"><strong>⚙️ Local technique</strong><small>Connexions, clés, fournisseurs et autorisations.</small></a>`}
      </div>
      <form class="access-project-form" id="houseProjectForm" hidden>
        <strong>Nouveau projet</strong>
        <input name="name" placeholder="Nom du projet" required />
        <textarea name="objective" placeholder="Expliquez ce que vous voulez obtenir, avec vos mots." required></textarea>
        <button class="primary" type="submit">Confier le projet à Gérard</button>
      </form>
    </section>`;
  }

  function slug(value) {
    return String(value || "project")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `project-${Date.now()}`;
  }

  function createProject(name, objective) {
    const id = `${slug(name)}-${Date.now().toString(36)}`;
    const parcel = {
      id,
      code: `CLIENT-${Date.now().toString(36).toUpperCase()}`,
      name,
      mission: objective,
      priorities: ["comprendre le projet", "préparer les premières Seeds", "réduire le travail humain"],
      version: 1,
      seeds: [{
        id: `${id}-first-intent`,
        title: "Première intention",
        type: "project",
        objective,
        firstHarvest: "Un diagnostic clair, les premières pistes et la prochaine action utile.",
        status: "planted",
        priority: 1,
        createdAt: new Date().toISOString()
      }]
    };
    global.GardenStore?.registerParcel?.(parcel);
    const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    projects.push({ id, name, objective, createdAt: new Date().toISOString() });
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    global.PoulpeAccess?.setContext?.({ mode: "owner" });
    global.GardenShell?.setActiveView?.("parcels");
    try { global.pushChat?.("gerard", `🌱 J’ai créé la parcelle « ${name} ». Je commence à observer ce qu’il faut y planter.`); } catch (_) {}
  }

  function enhance() {
    const shell = document.getElementById("gardenShell");
    if (!shell) return;
    const nav = shell.querySelector(".shell-nav");
    if (!nav) return;

    const context = access();
    const labels = {
      garden: "Garden",
      activity: "Ce que fait Gérard",
      parcels: context.mode === "client" ? "Mon projet" : "Toutes les parcelles",
      missions: "Travail en cours",
      technical: "Réglages avancés"
    };
    nav.querySelectorAll("[data-shell-view]").forEach((button) => {
      const view = button.dataset.shellView;
      if (labels[view]) button.textContent = labels[view];
      if (context.mode === "client" && view === "technical") button.hidden = true;
    });

    if (!nav.querySelector("[data-house-home]")) {
      const home = document.createElement("button");
      home.type = "button";
      home.dataset.houseHome = "true";
      home.textContent = "Accueil";
      home.addEventListener("click", () => {
        const content = shell.querySelector(".shell-content");
        if (content) content.innerHTML = renderHome();
        bindHome();
      });
      nav.prepend(home);
    }
  }

  function bindHome() {
    document.getElementById("houseNewProject")?.addEventListener("click", () => {
      document.getElementById("houseProjectForm")?.toggleAttribute("hidden");
    });
    document.getElementById("houseProjectForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      createProject(String(form.get("name") || "Nouveau projet").trim(), String(form.get("objective") || "").trim());
    });
    document.querySelectorAll("[data-house-view]").forEach((button) => {
      button.addEventListener("click", () => global.GardenShell?.setActiveView?.(button.dataset.houseView || "garden"));
    });
    document.getElementById("houseOwnerAll")?.addEventListener("click", () => {
      global.PoulpeAccess?.setContext?.({ mode: "owner", parcelId: null, clientId: null });
      global.GardenShell?.setActiveView?.("parcels");
    });
  }

  function openHomeOnFirstVisit() {
    const shell = document.getElementById("gardenShell");
    const content = shell?.querySelector(".shell-content");
    if (!content || sessionStorage.getItem("poulpe-fiction:house-opened")) return;
    sessionStorage.setItem("poulpe-fiction:house-opened", "1");
    content.innerHTML = renderHome();
    bindHome();
  }

  const observer = new MutationObserver(() => enhance());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => { enhance(); openHomeOnFirstVisit(); }, 100);
  global.addEventListener("poulpe-access-changed", () => setTimeout(enhance, 0));

  global.PoulpeHouse = { renderHome, createProject, enhance };
})(globalThis);
