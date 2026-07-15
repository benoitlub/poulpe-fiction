(function interactionUnlockModule(global) {
  "use strict";

  const UNLOCK_AFTER_MS = 3000;
  let unlocked = false;

  function unlock(reason) {
    if (unlocked) return;
    unlocked = true;

    // Never call window.stop() here. It can abort the remaining scripts after
    // the HTML is visible, leaving buttons rendered but without their handlers.
    document.documentElement.removeAttribute("inert");
    document.body?.removeAttribute("inert");
    document.getElementById("root")?.removeAttribute("inert");
    document.documentElement.classList.add("poulpe-interactions-unlocked");

    document.querySelectorAll("[data-authorize-departure], [data-view-bag], button.primary, button.ghost, button.objective").forEach((button) => {
      button.style.pointerEvents = "auto";
      button.style.touchAction = "manipulation";
    });

    global.__POULPE_INTERACTION_UNLOCK__ = {
      at: new Date().toISOString(),
      reason: reason || "watchdog",
    };

    try {
      document.dispatchEvent(new CustomEvent("poulpe-interactions-unlocked", {
        detail: global.__POULPE_INTERACTION_UNLOCK__,
      }));
    } catch (_) {}
  }

  // DOMContentLoaded is enough to make the local interface usable. We no longer
  // wait for every remote/resource load to finish before releasing interactions.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => unlock("interface locale prête"), { once: true });
  } else {
    unlock("document déjà prêt");
  }

  global.setTimeout(() => unlock("watchdog local après 3 secondes"), UNLOCK_AFTER_MS);
  global.InteractionUnlock = { unlock, isUnlocked: () => unlocked };
})(globalThis);
