(function parcelsViewLockModule(global) {
  "use strict";

  let applying = false;
  let observer = null;

  function selectedView() {
    return document.body?.dataset?.constitutionView
      || global.ConstitutionUX?.currentView?.()
      || "gerard";
  }

  function apply() {
    if (applying || selectedView() !== "parcels") return;
    applying = true;
    try {
      try {
        const current = localStorage.getItem("poulpe-fiction:main-view:v1");
        if (current !== "parcels") localStorage.setItem("poulpe-fiction:main-view:v1", "parcels");
      } catch (_) {}

      global.GardenShell?.mount?.();

      const shell = document.getElementById("gardenShell");
      if (shell) {
        shell.classList.remove("constitution-hidden", "constitution-managed");
        shell.hidden = false;
        shell.style.removeProperty("display");
        shell.dataset.activeView = "parcels";
      }

      document.querySelectorAll("#root > .blacklace-parcel, #root > [data-blacklace-parcel]").forEach((node) => {
        node.classList.add("constitution-hidden");
        node.hidden = true;
      });

      document.querySelectorAll("#root > .garden-shell").forEach((node) => {
        if (node !== shell) node.remove();
      });
    } finally {
      applying = false;
    }
  }

  function schedule() {
    requestAnimationFrame(apply);
    global.setTimeout(apply, 50);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-constitution-view="parcels"], [data-shell-view="parcels"]');
    if (!button) return;
    try { sessionStorage.setItem("poulpe-fiction:constitution-view:v2", "parcels"); } catch (_) {}
    try { localStorage.setItem("poulpe-fiction:main-view:v1", "parcels"); } catch (_) {}
    schedule();
  }, true);

  global.addEventListener("poulpe-garden-changed", schedule);
  global.addEventListener("poulpe-access-changed", schedule);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }

  observer = new MutationObserver(() => {
    if (selectedView() === "parcels") schedule();
  });
  const root = document.getElementById("root");
  if (root) observer.observe(root, { childList: true, subtree: false, attributes: true, attributeFilter: ["class", "hidden"] });

  global.ParcelsViewLock = { apply, schedule };
})(globalThis);
