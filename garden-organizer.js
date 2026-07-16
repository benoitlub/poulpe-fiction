(function gardenOrganizerModule(global) {
  "use strict";

  const SELECTED_KEY = "poulpe-fiction:garden:selected-parcel:v1";
  let applying = false;

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [], operations: [], harvests: [] };
  }

  function selectedId(data) {
    try {
      const saved = localStorage.getItem(SELECTED_KEY);
      if (saved && data.parcels.some((parcel) => parcel.id === saved)) return saved;
    } catch (_) {}
    return data.activeParcelId || data.parcels[0]?.id || null;
  }

  function saveSelected(parcelId) {
    try { localStorage.setItem(SELECTED_KEY, parcelId); } catch (_) {}
  }

  function parcelDetail(data, parcel) {
    const seeds = data.seeds.filter((seed) => seed.parcelId === parcel.id);
    const missions = data.operations.filter((operation) => operation.parcelId === parcel.id);
    const harvests = data.harvests.filter((harvest) => harvest.parcelId === parcel.id);
    const active = seeds.find((seed) => seed.id === data.activeSeedId) || seeds[0];
    return `<section class="parcel-focus" data-parcel-focus="${esc(parcel.id)}">
      <div class="parcel-focus-head"><div><p class="eyebrow">Parcelle consultée</p><h2>${esc(parcel.name || parcel.id)}</h2></div><span class="shell-status">${seeds.length} Seed(s)</span></div>
      <p>${esc(parcel.mission || "Aucune mission renseignée")}</p>
      <div class="parcel-focus-stats"><span>🌱 ${seeds.length}</span><span>🐙 ${missions.length}</span><span>🌾 ${harvests.length}</span></div>
      ${active ? `<p class="parcel-focus-current"><strong>En tête :</strong> ${esc(active.title || active.id)} · ${esc(active.status || "plantée")}</p>` : ""}
      <div class="parcel-focus-actions">
        ${active ? `<button class="primary" type="button" data-activate-parcel-seed="${esc(parcel.id)}" data-seed-id="${esc(active.id)}">Ouvrir cette parcelle</button>` : ""}
        <button class="ghost" type="button" data-open-parcel-missions="${esc(parcel.id)}">Voir ses missions</button>
        <button class="ghost" type="button" data-open-parcel-harvests="${esc(parcel.id)}">Voir ses récoltes</button>
      </div>
    </section>`;
  }

  function organizeParcels(shell, data) {
    const content = shell.querySelector(".shell-content");
    if (!content || shell.dataset.activeView !== "parcels") return;
    const grid = content.querySelector(".shell-grid");
    if (!grid) return;

    const form = content.querySelector(".parcel-create-card");
    if (form && !form.closest("details")) {
      const details = document.createElement("details");
      details.className = "parcel-create-drawer";
      details.innerHTML = "<summary>＋ Créer une nouvelle parcelle client</summary>";
      form.parentNode.insertBefore(details, form);
      details.appendChild(form);
    }

    let toolbar = content.querySelector(".parcel-catalog-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("section");
      toolbar.className = "parcel-catalog-toolbar";
      grid.parentNode.insertBefore(toolbar, grid);
    }
    toolbar.innerHTML = `<div><p class="eyebrow">Toutes les parcelles</p><strong>${data.parcels.length} parcelle(s) consultables</strong></div><label>Rechercher<input type="search" data-parcel-search placeholder="Nom, mission, client…"></label>`;

    const cards = Array.from(grid.querySelectorAll(":scope > .shell-card"));
    cards.forEach((card, index) => {
      const parcel = data.parcels[index];
      if (!parcel) return;
      card.dataset.parcelCatalogId = parcel.id;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      if (!card.querySelector("[data-consult-parcel]")) card.insertAdjacentHTML("beforeend", `<button class="ghost parcel-consult" type="button" data-consult-parcel="${esc(parcel.id)}">Consulter</button>`);
    });

    const currentId = selectedId(data);
    const current = data.parcels.find((parcel) => parcel.id === currentId) || data.parcels[0];
    content.querySelector(".parcel-focus")?.remove();
    if (current) toolbar.insertAdjacentHTML("afterend", parcelDetail(data, current));
    cards.forEach((card) => card.classList.toggle("selected", card.dataset.parcelCatalogId === current?.id));

    toolbar.querySelector("[data-parcel-search]")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      cards.forEach((card) => {
        const parcel = data.parcels.find((item) => item.id === card.dataset.parcelCatalogId);
        const haystack = `${parcel?.name || ""} ${parcel?.mission || ""} ${parcel?.client?.name || ""}`.toLowerCase();
        card.hidden = Boolean(query && !haystack.includes(query));
      });
    });
  }

  function bind(shell) {
    shell.querySelectorAll("[data-consult-parcel]").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        saveSelected(button.dataset.consultParcel);
        apply();
      };
    });
    shell.querySelectorAll("[data-parcel-catalog-id]").forEach((card) => {
      const open = () => { saveSelected(card.dataset.parcelCatalogId); apply(); };
      card.onclick = (event) => { if (!event.target.closest("button,a,input,textarea")) open(); };
      card.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } };
    });
    shell.querySelector("[data-activate-parcel-seed]")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      try { global.GardenStore?.activateSeed?.(button.dataset.activateParcelSeed, button.dataset.seedId); } catch (_) {}
      global.GardenShell?.setActiveView?.("garden");
    });
    shell.querySelector("[data-open-parcel-missions]")?.addEventListener("click", () => global.GardenShell?.setActiveView?.("missions"));
    shell.querySelector("[data-open-parcel-harvests]")?.addEventListener("click", () => global.GardenShell?.setActiveView?.("harvests"));
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      const shell = document.getElementById("gardenShell");
      if (!shell) return;
      const data = snapshot();
      organizeParcels(shell, data);
      bind(shell);
      document.body.classList.add("garden-organized");
    } finally { applying = false; }
  }

  const observer = new MutationObserver(() => global.setTimeout(apply, 0));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  global.addEventListener("poulpe-garden-changed", () => global.setTimeout(apply, 0));
  global.addEventListener("load", () => global.setTimeout(apply, 500), { once: true });
  global.GardenOrganizer = { apply, SELECTED_KEY };
  global.setTimeout(apply, 0);
})(globalThis);
