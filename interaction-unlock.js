(function interactionUnlockModule(global) {
  "use strict";

  const UNLOCK_AFTER_MS = 8000;
  let unlocked = false;

  function unlock(reason) {
    if (unlocked) return;
    unlocked = true;

    try { global.stop?.(); } catch (_) {}

    document.documentElement.removeAttribute("inert");
    document.body?.removeAttribute("inert");
    document.getElementById("root")?.removeAttribute("inert");
    document.documentElement.classList.add("poulpe-interactions-unlocked");

    document.querySelectorAll("[data-authorize-departure], [data-view-bag], button.primary, button.ghost").forEach((button) => {
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

  global.setTimeout(() => unlock("chargement résiduel interrompu après 8 secondes"), UNLOCK_AFTER_MS);
  global.addEventListener("load", () => unlock("chargement terminé"), { once: true });
  global.InteractionUnlock = { unlock, isUnlocked: () => unlocked };
})(globalThis);
