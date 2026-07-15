(function constitutionUxModule(global) {
  "use strict";

  const VIEW_KEY = "poulpe-fiction:constitution-view:v2";
  const VALID_VIEWS = new Set(["gerard", "parcels", "harvests", "garden", "atelier"]);
  let applying = false;

  function currentView() {
    try {
      const saved = sessionStorage.getItem(VIEW_KEY) || "gerard";
      return VALID_VIEWS.has(saved) ? saved : "gerard";
    } catch (_) {
      return "gerard";
    }
  }

  function setView(view) {
    if (!VALID_VIEWS.has(view)) return;
    try { sessionStorage.setItem(VIEW_KEY, view); } catch (_) {}
    apply(view);
    global.scrollTo({ top: 0, behavior: "smooth" });
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[char]));
  }

  function activeSeed() {
    const context = global.BlacklaceParcel?.activeSeed?.();
    const seeds = global.BlacklaceParcel?.parcel?.seeds || [];
    return context ? seeds.find((seed) => seed.id === context.seedId) || context : null;
  }

  function statusCopy(seed) {
    const map = {
      planted: ["Je garde cette Seed dans mon jardin.", "Observer la parcelle"],
      observing: ["J'observe cette Seed et je rassemble ce qui peut l'aider.", "Ouvrir la parcelle"],
      growing: ["Je fais pousser cette Seed avec mes tentacules.", "Ouvrir la parcelle"],
      "bag-ready": ["Son sac est prêt. J'attends ton autorisation pour partir.", "Voir le sac"],
      adventure: ["Je suis en mission. Je reviens dès que la récolte est prête.", "Suivre la mission"],
      harvested: ["Une récolte est disponible.", "Voir la récolte"],
      composted: ["Cette piste repose au compost, avec ses apprentissages.", "Ouvrir la parcelle"]
    };
    return map[seed?.status] || ["Je regarde ce qui pousse aujourd'hui.", "Voir les parcelles"];
  }

  function latestActivity(seed) {
    try {
      const snapshot = global.GardenStore?.snapshot?.() || {};
      const harvests = Array.isArray(snapshot.harvests) ? snapshot.harvests : [];
      const operations = Array.isArray(snapshot.operations) ? snapshot.operations : [];
      const harvest = harvests.find((item) => item.seedId === seed?.id) || harvests[0];
      if (harvest) return `Dernière récolte : ${harvest.title || "nouveau résultat"}`;
      const operation = operations.find((item) => item.seedId === seed?.id) || operations[0];
      if (operation) return operation.activity || operation.intent || "Mission en cours";
    } catch (_) {}
    return seed?.lastTentacleRole ? `${seed.lastTentacleRole} travaille sur la Seed` : "Gérard veille sur le jardin";
  }

  function progress(seed) {
    const value = Number(seed?.maturity);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  }

  function ensureShell(root, selected) {
    let shell = document.querySelector(".constitution-shell");
    if (!shell) {
      shell = document.createElement("section");
      shell.className = "constitution-shell";
      root.insertAdjacentElement("beforebegin", shell);
    }

    const seed = activeSeed();
    const copy = statusCopy(seed);
    const maturity = progress(seed);
    const tentacles = global.GerardScheduler?.snapshot?.().tentacles || [];
    const activeTentacles = tentacles.filter((item) => item.seedId).length;

    shell.innerHTML = `
      <nav class="constitution-nav" aria-label="Navigation principale">
        <button type="button" data-constitution-view="gerard">🐙 Gérard</button>
        <button type="button" data-constitution-view="parcels">📂 Parcelles</button>
        <button type="button" data-constitution-view="harvests">🌾 Récoltes</button>
        <button type="button" data-constitution-view="atelier">🏭 Atelier</button>
        <button type="button" data-constitution-view="garden">🌱 Garden</button>
      </nav>
      <button type="button" class="constitution-return${selected === "gerard" ? " constitution-hidden" : ""}" data-return-gerard>← Gérard</button>
      <article class="gerard-companion-card${selected === "gerard" ? "" : " constitution-hidden"}">
        <div class="gerard-companion-heading">
          <div><p class="eyebrow">🐙 Gérard maintenant</p><h2>${esc(seed?.title || "Le jardin")}</h2></div>
          <span>${activeTentacles || 0}/8 tentacules actives</span>
        </div>
        <p class="gerard-companion-sentence">${esc(copy[0])}</p>
        <div class="gerard-progress" aria-label="Progression ${maturity}%"><span style="width:${maturity}%"></span></div>
        <div class="gerard-companion-foot"><small>${esc(latestActivity(seed))}</small><button class="primary" type="button" data-companion-primary>${esc(copy[1])}</button></div>
      </article>`;

    shell.querySelectorAll("[data-constitution-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.constitutionView === selected);
      button.onclick = () => setView(button.dataset.constitutionView);
    });
    const back = shell.querySelector("[data-return-gerard]");
    if (back) back.onclick = () => setView("gerard");
    const primary = shell.querySelector("[data-companion-primary]");
    if (primary) primary.onclick = () => setView(seed?.status === "harvested" ? "harvests" : "parcels");
  }

  function mark(node, visible) {
    if (!node) return;
    node.classList.toggle("constitution-hidden", !visible);
  }

  function markAll(nodes, visible) {
    Array.from(nodes || []).forEach((node) => mark(node, visible));
  }

  function directRootSections(root) {
    return Array.from(root.children).filter((node) => node.nodeType === 1);
  }

  function compactGarden(root, selected) {
    root.querySelectorAll(".constitution-redundant").forEach((node) => node.classList.remove("constitution-redundant"));
    if (selected !== "garden") return;

    const phrases = ["backend lisible", "garden · hublot technique", "serre publisher", "postgresql · vie persistante"];
    root.querySelectorAll("h1,h2,h3,h4,p,.eyebrow,.kicker,strong").forEach((node) => {
      const text = (node.textContent || "").trim().toLowerCase();
      if (!phrases.some((phrase) => text.includes(phrase))) return;
      const panel = node.closest("article,section,.panel,.card,.garden-card,.garden-summary") || node.parentElement;
      if (panel && !panel.classList.contains("hublot") && !panel.classList.contains("garden-hublot")) {
        panel.classList.add("constitution-redundant");
      }
    });

    root.querySelectorAll(".garden-dashboard [class*='stat'], .garden-dashboard [class*='metric'], .garden-dashboard .summary-card").forEach((node) => {
      node.classList.add("constitution-redundant");
    });
    root.querySelectorAll(".garden-dashboard nav, .garden-dashboard .garden-tabs, .garden-dashboard .view-tabs").forEach((node) => {
      node.classList.add("constitution-redundant");
    });
  }

  function apply(view) {
    if (applying) return;
    const root = document.getElementById("root");
    if (!root) return;
    applying = true;
    try {
      const selected = VALID_VIEWS.has(view) ? view : currentView();
      document.body.dataset.constitutionView = selected;
      ensureShell(root, selected);

      const parcel = root.querySelector(".blacklace-parcel");
      const chat = root.querySelector(".gerard-chat");
      const tentacles = document.querySelector(".gerard-tentacles-panel");
      const plans = root.querySelectorAll(".production-plan, .production-pack");
      const dashboards = root.querySelectorAll(".garden-dashboard");
      const hublots = root.querySelectorAll(".hublot, .garden-hublot");
      const gardenShells = root.querySelectorAll(".garden-shell, [data-garden-shell]");
      const clientAdmin = root.querySelectorAll(".client-access, .client-parcel-portal, .parcel-client-portal");
      const activity = root.querySelectorAll(".activity-echo, .adventure-journal, .mission-timeline");

      directRootSections(root).forEach((section) => section.classList.add("constitution-managed"));

      mark(parcel, selected === "gerard" || selected === "parcels");
      mark(chat, selected === "gerard");
      mark(tentacles, selected === "garden");
      markAll(plans, selected === "atelier");
      markAll(clientAdmin, selected === "parcels");
      markAll(activity, selected === "garden");
      markAll(dashboards, selected === "harvests" || selected === "garden");
      markAll(hublots, selected === "garden");
      markAll(gardenShells, selected === "garden");

      if (parcel) {
        parcel.classList.toggle("constitution-home", selected === "gerard");
        const picker = parcel.querySelector(".seed-picker");
        const summary = parcel.querySelector(".seed-life-summary");
        const plantedList = parcel.querySelector("details, .seed-list, .planted-seeds");
        mark(picker, selected === "parcels");
        mark(summary, selected === "parcels");
        if (plantedList) mark(plantedList, selected === "parcels");
      }

      if (selected === "harvests") {
        try { global.GardenPersistence?.saveDashboardState?.({ selectedView: "harvests" }); } catch (_) {}
      } else if (selected === "garden") {
        try { global.GardenPersistence?.saveDashboardState?.({ selectedView: "hublot" }); } catch (_) {}
      }

      compactGarden(root, selected);
    } finally {
      applying = false;
    }
  }

  const baseRender = global.render;
  if (typeof baseRender === "function") {
    global.render = function constitutionRenderWrapper() {
      const x = global.scrollX;
      const y = global.scrollY;
      const result = baseRender.apply(this, arguments);
      apply(currentView());
      requestAnimationFrame(() => global.scrollTo(x, y));
      return result;
    };
  }

  global.ConstitutionUX = { apply, setView, currentView };
  apply(currentView());
  global.addEventListener("load", () => apply(currentView()), { once: true });
})(globalThis);
