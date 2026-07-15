(function departureControllerModule(global) {
  "use strict";

  const TIMEOUT_MS = 20000;
  let inFlight = false;

  function timeoutPromise() {
    return new Promise((_, reject) => {
      global.setTimeout(() => reject(new Error("Le départ vers Octopus a dépassé 20 secondes.")), TIMEOUT_MS);
    });
  }

  function setSeedStatus(seedId, status, extra = {}) {
    const seed = global.BlacklaceParcel?.parcel?.seeds?.find?.((item) => item.id === seedId);
    if (seed) Object.assign(seed, extra, { status, updatedAt: new Date().toISOString() });
    try { global.GardenStore?.updateSeed?.(seedId, { status, ...extra }); } catch (_) {}
  }

  function showProgress(message, kind = "progress") {
    const root = document.getElementById("root");
    if (!root) return;
    let panel = document.getElementById("departureStatusPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "departureStatusPanel";
      panel.className = "greenhouse departure-status";
      root.prepend(panel);
    }
    panel.innerHTML = `<div><p class="eyebrow">Départ de Gérard</p><h2>${kind === "error" ? "⚠️" : kind === "done" ? "🧺" : "🐙"} ${String(message)}</h2><p>${kind === "progress" ? "La page reste utilisable pendant que le moteur répond." : ""}</p></div>`;
  }

  async function depart(seedId, button) {
    if (inFlight) return;
    inFlight = true;
    const originalLabel = button?.textContent || "Autoriser le départ";
    if (button) {
      button.disabled = true;
      button.textContent = "🐙 Gérard part…";
    }

    try {
      let draft = global.AdventureDraft?.load?.();
      if (!draft || draft.curiosity?.id !== seedId) {
        draft = await Promise.race([
          global.BlacklaceParcel?.prepareSeedAdventure?.(seedId, { silent: true }),
          timeoutPromise(),
        ]);
      }
      draft = global.AdventureDraft?.load?.() || draft;
      if (!draft) throw new Error("Le sac d’aventure est introuvable.");
      if (draft.status === "prepared") {
        draft = global.AdventureDraft.validate(draft, "Départ autorisé explicitement par Benoît depuis la parcelle.");
      }
      if (draft.status !== "validated") throw new Error("Le sac n’est pas validé.");

      setSeedStatus(seedId, "adventure", { departureAuthorizedAt: new Date().toISOString() });
      showProgress("Gérard transmet l’aventure à Octopus…");

      await Promise.race([
        Promise.resolve(global.AdventureLaunch?.launch?.()),
        timeoutPromise(),
      ]);

      const apiError = global.state?.apiError || null;
      if (apiError) throw new Error(apiError);
      showProgress("Le départ a été traité. Le retour est inscrit dans la mission.", "done");
      global.GardenShell?.setActiveView?.("missions");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le départ a échoué.";
      setSeedStatus(seedId, "bag-ready");
      try {
        if (global.state) {
          global.state.apiError = message;
          global.state.step = "result";
        }
      } catch (_) {}
      showProgress(message, "error");
    } finally {
      inFlight = false;
      if (button && button.isConnected) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-authorize-departure]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void depart(button.dataset.authorizeDeparture, button);
  }, true);

  global.DepartureController = { depart, isRunning: () => inFlight };
})(globalThis);
