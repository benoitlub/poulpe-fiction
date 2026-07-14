(function gardenStageViewModule(global) {
  "use strict";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }
  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [], operations: [], harvests: [] };
  }
  function parcelState(data, parcel) {
    const seeds = (data.seeds || []).filter((item) => item.parcelId === parcel.id);
    const operations = (data.operations || []).filter((item) => item.parcelId === parcel.id);
    const harvests = (data.harvests || []).filter((item) => item.parcelId === parcel.id);
    const blocked = operations.some((item) => ["blocked", "failed", "waiting-authorization"].includes(String(item.status || "").toLowerCase()));
    const active = operations.some((item) => ["queued", "running", "active", "processing"].includes(String(item.status || "").toLowerCase()));
    if (blocked) return { label: "Bloquée", icon: "🪨", detail: "Une autorisation ou une erreur demande de l’attention." };
    if (active) return { label: "En croissance", icon: "🌿", detail: "Une mission réelle est en cours." };
    if (harvests.length) return { label: "Récolte disponible", icon: "🌾", detail: "Un retour peut être examiné." };
    if (seeds.length) return { label: "En germination", icon: "🌱", detail: "Une ou plusieurs Seeds attendent de mûrir." };
    return { label: "En observation", icon: "👀", detail: "Gérard veille sans mission active." };
  }
  function latest(items) {
    return items.slice().sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
  }
  function render() {
    const data = snapshot();
    const parcels = data.parcels || [];
    const recent = [
      ...(data.seeds || []).map((item) => ({ ...item, kind: "Seed" })),
      ...(data.operations || []).map((item) => ({ ...item, kind: "Mission" })),
      ...(data.harvests || []).map((item) => ({ ...item, kind: "Récolte" })),
    ].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, 6);

    const parcelCards = parcels.length
      ? parcels.map((parcel) => {
          const state = parcelState(data, parcel);
          const seeds = (data.seeds || []).filter((item) => item.parcelId === parcel.id);
          const operations = (data.operations || []).filter((item) => item.parcelId === parcel.id);
          const harvests = (data.harvests || []).filter((item) => item.parcelId === parcel.id);
          const current = latest([...seeds, ...operations, ...harvests]);
          return `<article class="shell-card"><p class="eyebrow">${state.icon} ${esc(state.label)}</p><h3>${esc(parcel.name || parcel.title || parcel.id)}</h3><p>${esc(state.detail)}</p><p>${seeds.length} Seed(s) · ${operations.length} mission(s) · ${harvests.length} récolte(s)</p>${current ? `<p class="shell-status">Dernier changement : ${esc(current.title || current.intent || current.activity || current.status || current.id)}</p>` : ""}</article>`;
        }).join("")
      : `<section class="shell-empty"><strong>Aucune parcelle visible.</strong><p>Le Garden affichera ici la croissance réelle dès qu’une parcelle sera synchronisée.</p></section>`;

    const recentList = recent.length
      ? `<section class="shell-list">${recent.map((item) => `<article><span class="shell-status">${esc(item.kind)}</span><div><strong>${esc(item.title || item.intent || item.activity || item.id)}</strong><p>${esc(item.status || item.obstacle?.message || "trace enregistrée")}</p></div></article>`).join("")}</section>`
      : `<section class="shell-empty"><strong>Aucune trace récente.</strong><p>Le calme est affiché comme tel ; aucune activité n’est simulée.</p></section>`;

    return `<section class="journey-card"><p class="eyebrow">Cycle réel du Garden</p><h3>Observation → Seed → Mission → Retour</h3><p>Chaque état ci-dessous provient de GardenStore. L’interface révèle l’activité ; elle ne la crée pas.</p><ol class="journey-stages"><li class="journey-stage done"><span>1</span><div><strong>Observation</strong><p>Publisher et les sources autorisées rendent un signal visible.</p></div></li><li class="journey-stage ${data.seeds?.length ? "active" : "pending"}"><span>2</span><div><strong>Seed</strong><p>${data.seeds?.length || 0} Seed(s) visible(s).</p></div></li><li class="journey-stage ${data.operations?.length ? "active" : "pending"}"><span>3</span><div><strong>Mission</strong><p>${data.operations?.length || 0} mission(s) tracée(s) par Octopus.</p></div></li><li class="journey-stage ${data.harvests?.length ? "done" : "pending"}"><span>4</span><div><strong>Retour au Garden</strong><p>${data.harvests?.length || 0} récolte(s) enregistrée(s).</p></div></li></ol></section><section class="shell-grid">${parcelCards}</section><section class="journey-card"><p class="eyebrow">Derniers changements réels</p><h3>Chronologie</h3>${recentList}</section>`;
  }

  function enhance() {
    if (localStorage.getItem("poulpe-fiction:main-view:v1") !== "backend") return;
    const content = document.querySelector("#gardenShell .shell-content");
    if (!content || content.querySelector(".garden-stage-detail")) return;
    const section = document.createElement("section");
    section.className = "garden-stage-detail";
    section.innerHTML = render();
    content.appendChild(section);
  }

  function install() {
    if (!global.GardenShell || global.GardenShell.__stageViewInstalled) return false;
    const baseMount = global.GardenShell.mount.bind(global.GardenShell);
    global.GardenShell.mount = function mountWithGardenStages() {
      baseMount();
      enhance();
    };
    global.GardenShell.__stageViewInstalled = true;
    enhance();
    return true;
  }

  install();
  global.setTimeout(install, 0);
  global.GardenStageView = { render, enhance };
})(globalThis);
