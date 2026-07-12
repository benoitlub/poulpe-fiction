(function terraHarvestLoopModule(global) {
  "use strict";

  const STATUS_KEY = "poulpe-fiction:terra-harvest-loop:v1";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[char]));
  }

  function publisherBaseUrl() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
    catch (_) { return ""; }
  }

  function loadStatus() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || "null") || {}; }
    catch (_) { return {}; }
  }

  function saveStatus(patch) {
    const value = Object.assign({}, loadStatus(), patch || {}, { updatedAt: new Date().toISOString() });
    localStorage.setItem(STATUS_KEY, JSON.stringify(value));
    return value;
  }

  function bundles() {
    return global.AdventureReturnProcessor?.loadOutbox?.() || [];
  }

  function saveBundle(bundle) {
    const previous = bundles().filter((item) => item.id !== bundle.id);
    localStorage.setItem(global.AdventureReturnProcessor.OUTBOX_KEY, JSON.stringify([bundle, ...previous].slice(0, 50)));
    return bundle;
  }

  function latestTerraBundle() {
    return bundles().find((bundle) =>
      bundle.parcelId === "blacklace-ecosystem" &&
      (bundle.harvests || []).some((harvest) => harvest.artifactType === "landing-page" || harvest.title?.includes("TERRA"))
    ) || null;
  }

  function landingHarvest(bundle) {
    return (bundle?.harvests || []).find((harvest) => harvest.artifactType === "landing-page" || harvest.title?.includes("Landing page"));
  }

  function visualHarvest(bundle) {
    return (bundle?.harvests || []).find((harvest) => harvest.artifactType === "instagram-visual" || harvest.url);
  }

  function canvaInput(text) {
    const lines = String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return {
      format: "instagram-post",
      title: "TERRA",
      headline: lines.find((line) => line.length <= 80) || "TERRA",
      subtitle: "Un roman à découvrir",
      body: lines.slice(0, 4).join("\n").slice(0, 700),
      cta: "Découvrir TERRA"
    };
  }

  function addVisualHarvest(bundle, artifact) {
    const visual = {
      id: `harvest_visual_${artifact.id || Date.now()}`,
      kind: "harvest",
      parcelId: bundle.parcelId,
      adventureDraftId: bundle.adventureDraftId,
      missionId: bundle.missionId,
      title: artifact.title || "Visuel Instagram TERRA",
      description: artifact.url || "Visuel Canva reçu.",
      artifactType: "instagram-visual",
      artifact: artifact,
      url: artifact.url,
      downloadUrl: artifact.downloadUrl || null,
      createdAt: new Date().toISOString()
    };
    return saveBundle(Object.assign({}, bundle, {
      harvests: [...(bundle.harvests || []).filter((item) => item.id !== visual.id), visual],
      deliveryStatus: "harvests-created"
    }));
  }

  async function authorizeCanva() {
    const bundle = latestTerraBundle();
    const landing = landingHarvest(bundle);
    if (!bundle || !landing) return;
    const base = publisherBaseUrl();
    if (!base) {
      saveStatus({ status: "failed", error: "Publisher indisponible.", action: "Ouvrir le Local technique" });
      render();
      return;
    }

    saveStatus({ status: "running", error: null, authorizedAt: new Date().toISOString() });
    render();
    try {
      const response = await fetch(`${base}/api/production/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: bundle.missionId,
          tool: "canva",
          action: "create_design",
          context: { parcelId: bundle.parcelId, seedId: "terra" },
          input: canvaInput(landing.artifact || landing.description)
        })
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "completed" || !payload.artifact?.url) {
        throw new Error(payload.error || "Aucun artefact Canva retourné.");
      }
      addVisualHarvest(bundle, payload.artifact);
      saveStatus({ status: "completed", canvaUrl: payload.artifact.url, error: null });
    } catch (error) {
      saveStatus({
        status: "failed",
        error: error instanceof Error ? error.message : "Erreur Canva",
        action: "Relancer uniquement l'étape Canva"
      });
    }
    render();
  }

  function renderPanel() {
    const bundle = latestTerraBundle();
    const landing = landingHarvest(bundle);
    if (!bundle || !landing || visualHarvest(bundle)) return "";
    const status = loadStatus();
    const text = String(landing.artifact || landing.description || "");
    const input = canvaInput(text);
    const error = status.error ? `<div class="garden-alert error"><strong>Canva</strong><span>${esc(status.error)}</span><small>${esc(status.action || "Réessayer")}</small></div>` : "";
    return `<section class="terra-canva-authorization">
      <p class="eyebrow">Autorisation Canva</p>
      <h3>Gérard a préparé le texte et le visuel Instagram.</h3>
      <ul>
        <li>Texte de landing page : prêt</li>
        <li>Contenu du visuel : ${esc(input.headline)}</li>
        <li>Outil : Canva via Publisher / Composio</li>
        <li>Coût estimé : dépend du compte Canva connecté</li>
        <li>Action externe : création d'un design Canva</li>
      </ul>
      ${error}
      <div class="play-actions">
        <button class="primary" data-authorize-canva ${status.status === "running" ? "disabled" : ""}>${status.status === "running" ? "Canva en cours..." : "Autoriser Canva"}</button>
        <button class="ghost" data-cancel-canva>Annuler</button>
      </div>
    </section>`;
  }

  function bind() {
    const authorize = document.querySelector("[data-authorize-canva]");
    if (authorize) authorize.onclick = authorizeCanva;
    const cancel = document.querySelector("[data-cancel-canva]");
    if (cancel) cancel.onclick = () => { saveStatus({ status: "waiting-authorization", error: "Autorisation refusée." }); render(); };
  }

  function render() {
    const panel = document.querySelector(".production-pack") || document.querySelector(".adventure-return") || document.querySelector(".panel");
    if (!panel || document.querySelector(".terra-canva-authorization")) return;
    const html = renderPanel();
    if (html) panel.insertAdjacentHTML("afterend", html);
    bind();
  }

  global.TerraHarvestLoop = { STATUS_KEY, latestTerraBundle, canvaInput, authorizeCanva, renderPanel };

  const baseRender = global.render;
  global.render = function renderWithTerraHarvestLoop() {
    baseRender();
    render();
  };
})(globalThis);
