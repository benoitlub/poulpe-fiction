(function departureControllerModule(global) {
  "use strict";

  const TIMEOUT_MS = 20000;
  const RECEIPT_KEY = "poulpe-fiction:adventure-departure:v1";
  let inFlight = false;

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function request(url, init) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { ...(init || {}), signal: controller.signal })
      .finally(() => global.clearTimeout(timer));
  }

  function getPanel() {
    let node = document.getElementById("departureStatusPanel");
    if (!node) {
      node = document.createElement("section");
      node.id = "departureStatusPanel";
      node.className = "greenhouse departure-status";
      const active = document.querySelector(".active-seed");
      if (active) active.insertAdjacentElement("afterend", node);
      else document.getElementById("root")?.prepend(node);
    }
    return node;
  }

  function show(message, kind = "progress", detail = "") {
    const node = getPanel();
    if (!node) return;
    const icon = kind === "error" ? "⚠️" : kind === "done" ? "🧺" : kind === "bag" ? "🎒" : "🐙";
    node.innerHTML = `<div><p class="eyebrow">${kind === "bag" ? "Sac de Gérard" : "Départ de Gérard"}</p><h2>${icon} ${esc(message)}</h2>${detail ? `<p style="white-space:pre-line">${esc(detail)}</p>` : ""}</div>`;
    node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showBag() {
    const draft = global.AdventureDraft?.load?.();
    if (!draft) {
      show("Aucun sac disponible", "error", "Gérard doit d’abord préparer une aventure.");
      return;
    }
    show(
      draft.curiosity?.title || "Sac prêt",
      "bag",
      [
        `Objectif : ${draft.objective || "aventure"}`,
        `Dans le sac : ${(draft.bag || []).join(" · ") || "rien d’enregistré"}`,
        `Pique-nique : ${(draft.picnic || []).join(" · ") || "aucun"}`,
        `Limites : ${(draft.limits || []).join(" · ") || "aucune limite enregistrée"}`,
      ].join("\n\n"),
    );
  }

  function setSeedStatus(seedId, status, extra = {}) {
    const seed = global.BlacklaceParcel?.parcel?.seeds?.find?.((item) => item.id === seedId);
    if (seed) Object.assign(seed, extra, { status, updatedAt: new Date().toISOString() });
    try { global.GardenStore?.updateSeed?.(seedId, { status, ...extra }); } catch (_) {}
  }

  async function depart(seedId, button) {
    if (inFlight) return;
    inFlight = true;
    const originalLabel = button?.textContent || "Autoriser le départ";
    if (button) {
      button.disabled = true;
      button.textContent = "🐙 Envoi à Octopus…";
    }

    try {
      let draft = global.AdventureDraft?.load?.();
      if (!draft || draft.curiosity?.id !== seedId) {
        throw new Error("Le sac affiché ne correspond pas à cette Seed.");
      }
      if (draft.status === "prepared") {
        draft = global.AdventureDraft.validate(draft, "Départ autorisé explicitement depuis la parcelle.");
      }
      if (draft.status !== "validated") throw new Error("Le sac n’est pas validé.");

      const payload = await global.AdventureLaunch?.toMissionPayload?.(draft);
      if (!payload) throw new Error("La mission n’a pas pu être préparée.");

      const octopusBase = String(global.PoulpeRuntimeConfig?.urls?.octopusApi || "").replace(/\/$/, "");
      if (!octopusBase) throw new Error("Octopus n’est pas configuré.");

      show("Transmission à Octopus…", "progress", "La page reste utilisable et ne change pas de vue.");
      const response = await request(`${octopusBase}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || `Octopus ${response.status}`);

      const operationId = result.operationId || result.missionId || result.id || payload.operationId;
      localStorage.setItem(RECEIPT_KEY, JSON.stringify({
        version: 3,
        adventureDraftId: draft.id,
        contextId: payload.context?.id,
        parcelId: payload.context?.id,
        departedAt: new Date().toISOString(),
        operationId,
        missionId: result.missionId || result.id || null,
        missionStatus: result.status || "unknown",
      }));

      const waiting = result.status === "waiting-authorization";
      setSeedStatus(seedId, waiting ? "bag-ready" : "adventure", {
        departureAuthorizedAt: new Date().toISOString(),
        operationId,
      });
      try { global.AdventureReturnProcessor?.process?.(draft, result, ""); } catch (_) {}

      show(
        waiting ? "Autorisation supplémentaire nécessaire" : "Mission reçue par Octopus",
        waiting ? "error" : "done",
        result.summary || result.output?.text || `État : ${result.status || "reçu"}`,
      );
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Octopus n’a pas répondu dans les 20 secondes."
        : error instanceof Error ? error.message : "Le départ a échoué.";
      setSeedStatus(seedId, "bag-ready");
      show(message, "error", "Le sac reste prêt et la page reste utilisable.");
    } finally {
      inFlight = false;
      if (button && button.isConnected) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  document.addEventListener("click", (event) => {
    const bagButton = event.target.closest?.("[data-view-bag]");
    if (bagButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showBag();
      return;
    }

    const departureButton = event.target.closest?.("[data-authorize-departure]");
    if (!departureButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void depart(departureButton.dataset.authorizeDeparture, departureButton);
  }, true);

  global.DepartureController = { depart, showBag, isRunning: () => inFlight };
})(globalThis);
