(function mobileViewGuard(global) {
  "use strict";

  const ALLOWED_BY_VIEW = {
    garden: [".garden-hublot", ".garden-primary", ".gerard-chat", ".greenhouse"],
    activity: [".activity-echo"],
    parcels: [".garden-primary"],
    missions: [".garden-runtime"],
    technical: []
  };

  function currentView() {
    return localStorage.getItem("poulpe-fiction:main-view:v1") || "garden";
  }

  function matchesAny(node, selectors) {
    return selectors.some((selector) => node.matches?.(selector));
  }

  function apply() {
    const root = document.getElementById("root");
    if (!root) return;

    const view = currentView();
    const allowed = ALLOWED_BY_VIEW[view] || ALLOWED_BY_VIEW.garden;

    root.querySelectorAll(":scope > *").forEach((node) => {
      const keep = node.id === "gardenShell" || matchesAny(node, allowed);
      node.toggleAttribute("hidden", !keep);
    });

    const shell = document.getElementById("gardenShell");
    if (shell) shell.removeAttribute("hidden");

    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
  }

  function bind() {
    document.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-shell-view]")) {
        setTimeout(apply, 0);
      }
    });

    const root = document.getElementById("root");
    if (root) {
      new MutationObserver(() => requestAnimationFrame(apply)).observe(root, {
        childList: true,
        subtree: false
      });
    }

    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  global.MobileViewGuard = { apply };
})(globalThis);
