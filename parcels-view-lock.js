(function parcelsViewLockModule(global) {
  "use strict";

  let applying = false;
  let observer = null;
  let scheduled = false;

  function selectedView() {
    return document.body?.dataset?.constitutionView
      || global.ConstitutionUX?.currentView?.()
      || "gerard";
  }

  function exposeShell(shell) {
    if (!shell) return;
    shell.classList.remove("constitution-hidden", "constitution-managed");
    shell.hidden = false;
    shell.style.removeProperty("display");
    shell.style.removeProperty("visibility");
    shell.style.removeProperty("opacity");
    shell.dataset.activeView = "parcels";

    shell.querySelectorAll(".constitution-hidden").forEach((node) => {
      if (node.closest(".production-plan, .production-pack")) return;
      node.classList.remove("constitution-hidden");
      node.hidden = false;
    });
  }

  function apply() {
    scheduled = false;
    if (applying || selectedView() !== "parcels") return;
    applying = true;
    try {
      try { localStorage.setItem("poulpe-fiction:main-view:v1", "parcels"); } catch (_) {}

      let shell = document.getElementById("gardenShell");
      if (!shell || shell.dataset.activeView !== "parcels" || !shell.querySelector(".shell-content")) {
        global.GardenShell?.mount?.();
        shell = document.getElementById("gardenShell");
      }
      exposeShell(shell);

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
    if (scheduled || selectedView() !== "parcels") return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-constitution-view="parcels"], [data-shell-view="parcels"]');
    if (!button) return;
    try { sessionStorage.setItem("poulpe-fiction:constitution-view:v2", "parcels"); } catch (_) {}
    try { localStorage.setItem("poulpe-fiction:main-view:v1", "parcels"); } catch (_) {}
    schedule();
    global.setTimeout(apply, 60);
  }, true);

  global.addEventListener("poulpe-garden-changed", schedule);
  global.addEventListener("poulpe-access-changed", schedule);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }

  const root = document.getElementById("root");
  if (root) {
    observer = new MutationObserver((mutations) => {
      if (applying || selectedView() !== "parcels") return;
      const erased = mutations.some((mutation) => {
        if (mutation.type === "childList") return true;
        const target = mutation.target;
        return target?.id === "gardenShell"
          || target?.closest?.("#gardenShell")
          || target?.classList?.contains("garden-shell");
      });
      if (erased) schedule();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
    });
  }

  global.ParcelsViewLock = { apply, schedule };
})(globalThis);
