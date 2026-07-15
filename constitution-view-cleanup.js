(function constitutionViewCleanup(global) {
  "use strict";

  const LEGACY_LABELS = ["gérard", "parcelles", "activité", "missions", "récoltes", "rêves & jeux", "hublot"];

  function selectedView() {
    return document.body.dataset.constitutionView || global.ConstitutionUX?.currentView?.() || "gerard";
  }

  function normalizedText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function closestPanel(node) {
    return node?.closest?.("section, article, .panel, .card, .garden-card, .garden-shell") || node?.parentElement || null;
  }

  function markHidden(node, hidden) {
    if (!node) return;
    node.classList.toggle("constitution-hidden", Boolean(hidden));
  }

  function productionWrappers(root, view) {
    root.querySelectorAll(".constitution-production-wrapper").forEach((node) => {
      node.classList.remove("constitution-production-wrapper");
      node.classList.remove("constitution-hidden");
    });
    root.querySelectorAll(".constitution-atelier-chrome").forEach((node) => {
      node.classList.remove("constitution-atelier-chrome");
      node.classList.remove("constitution-hidden");
    });

    root.querySelectorAll(".production-plan, .production-pack").forEach((production) => {
      let wrapper = production.parentElement;
      while (wrapper && wrapper !== root) {
        const text = normalizedText(wrapper);
        if (text.includes("serre publisher") || text.includes("bouture intéressante dans la serre")) break;
        wrapper = wrapper.parentElement;
      }
      if (!wrapper || wrapper === root) wrapper = closestPanel(production);
      if (!wrapper) return;

      wrapper.classList.add("constitution-production-wrapper");
      markHidden(wrapper, view !== "atelier");
      if (view !== "atelier") return;

      Array.from(wrapper.children).forEach((child) => {
        if (child === production || child.contains(production)) return;
        child.classList.add("constitution-atelier-chrome");
        markHidden(child, true);
      });
    });
  }

  function removeSerreOutsideAtelier(root, view) {
    if (view === "atelier") return;
    root.querySelectorAll("section, article, .panel, .card, .garden-card").forEach((panel) => {
      const text = normalizedText(panel);
      if (!text.includes("serre publisher") && !text.includes("bouture intéressante dans la serre")) return;
      if (panel.querySelector(".production-plan, .production-pack")) {
        markHidden(panel, true);
      }
    });
  }

  function removeForeignPanels(root, view) {
    root.querySelectorAll("section, article, .panel, .card").forEach((panel) => {
      const text = normalizedText(panel);
      if (view === "atelier") {
        const isCabin = text.includes("cabane de départ") || text.includes("parler avec gérard");
        const isHublot = text.includes("hublot du garden") || text.includes("ce qui vit maintenant");
        if ((isCabin || isHublot) && !panel.querySelector(".production-plan, .production-pack")) markHidden(panel, true);
      }
      if (view === "garden") {
        const isProduction = panel.querySelector(".production-plan, .production-pack") || text.includes("plan de production");
        if (isProduction) markHidden(panel, true);
      }
      if (["gerard", "parcels", "harvests"].includes(view)) {
        const isPublisher = text.includes("serre publisher") || text.includes("plan de production");
        if (isPublisher) markHidden(panel, true);
      }
    });
  }

  function removeNestedMenus(root) {
    const candidates = new Set(root.querySelectorAll("nav, [role='tablist'], .garden-tabs, .view-tabs, .tabs, .tab-bar, .subnav, .secondary-nav"));
    root.querySelectorAll("div").forEach((node) => {
      const controls = Array.from(node.children).filter((child) => child.matches?.("button, a"));
      if (controls.length >= 3) candidates.add(node);
    });

    candidates.forEach((node) => {
      if (node.classList.contains("constitution-nav") || node.closest(".constitution-shell")) return;
      const labels = Array.from(node.querySelectorAll("button, a")).map(normalizedText);
      const matches = LEGACY_LABELS.filter((label) => labels.some((text) => text.includes(label))).length;
      if (matches >= 2) markHidden(node, true);
    });
  }

  function applyCleanup() {
    const root = document.getElementById("root");
    if (!root) return;
    const view = selectedView();
    productionWrappers(root, view);
    removeSerreOutsideAtelier(root, view);
    removeForeignPanels(root, view);
    removeNestedMenus(root);
  }

  const baseRender = global.render;
  if (typeof baseRender === "function") {
    global.render = function renderWithConstitutionCleanup() {
      const result = baseRender.apply(this, arguments);
      applyCleanup();
      requestAnimationFrame(applyCleanup);
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-constitution-view]")) return;
    requestAnimationFrame(applyCleanup);
  });

  global.addEventListener("load", applyCleanup, { once: true });
  applyCleanup();
})(globalThis);
