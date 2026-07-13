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

  function octopusBaseUrl() {
    try { return typeof OCTOPUS_API === "string" ? OCTOPUS_API.replace(/\/$/, "") : ""; }
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

  function recordTransition(label, detail) {
    const status = loadStatus();
    const events = Array.isArray(status.events) ? status.events : [];
    saveStatus({
      events: [{ at: new Date().toISOString(), label, detail: detail || "" }, ...events].slice(0, 30)
    });
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
      subtitle: "Un roman a decouvrir",
      body: lines.slice(0, 4).join("\n").slice(0, 700),
      cta: "Decouvrir TERRA"
    };
  }

  function extractMissionText(payload) {
    const result = payload?.result || payload;
    const output = result?.output || result;
    const artifacts = output?.artifacts || result?.artifacts || payload?.artifacts || [];
    const landing = Array.isArray(artifacts)
      ? artifacts.find((item) => item?.artifactType === "landing-page" || item?.type === "landing-page")
      : null;
    return String(
      landing?.artifact ||
      landing?.content ||
      output?.text ||
      result?.text ||
      payload?.text ||
      "Landing page TERRA\n\nTERRA est pret a etre presente avec une page claire, une promesse lisible et un appel a l'action vers la decouverte du livre."
    );
  }

  function currentDraft() {
    return global.AdventureDraft?.load?.() || null;
  }

  function landingBundleFromMission(operationId, payload) {
    const draft = currentDraft();
    const text = extractMissionText(payload);
    const createdAt = new Date().toISOString();
    return {
      version: 1,
      id: `return_${operationId}`,
      status: "ready",
      deliveryStatus: "landing-created",
      parcelId: "blacklace-ecosystem",
      adventureDraftId: draft?.id || null,
      missionId: operationId,
      createdAt,
      harvests: [{
        id: `harvest_landing_${operationId}`,
        kind: "harvest",
        parcelId: "blacklace-ecosystem",
        adventureDraftId: draft?.id || null,
        missionId: operationId,
        title: "Landing page TERRA",
        description: text.slice(0, 240),
        artifactType: "landing-page",
        artifact: text,
        createdAt
      }],
      seeds: [],
      questions: [],
      learnings: [],
      failure: null,
      rawMission: payload
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
      description: artifact.url || "Visuel Canva recu.",
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

  async function produceNow() {
    const existing = latestTerraBundle();
    if (landingHarvest(existing)) {
      recordTransition("Landing page deja produite", "La boucle attend l'autorisation Canva.");
      render();
      return existing;
    }
    const base = octopusBaseUrl();
    if (!base) {
      saveStatus({ status: "failed", error: "Octopus API indisponible.", action: "Verifier le Local technique" });
      recordTransition("Octopus bloque", "Aucune URL Octopus disponible.");
      render();
      return null;
    }

    const operationId = `terra_production_${Date.now()}`;
    saveStatus({ status: "running", error: null, operationId });
    recordTransition("Octopus analyse", "Production landing page TERRA.");
    render();

    try {
      const response = await fetch(`${base}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          title: "Produire la landing page TERRA",
          objective: "Creer une landing page exploitable pour presenter TERRA.",
          parcelId: "blacklace-ecosystem",
          seedId: "terra",
          requiredCapabilities: ["copy.generate"],
          authorizedResources: ["mistral"],
          metadata: {
            parcelId: "blacklace-ecosystem",
            seedId: "terra",
            expectedHarvests: ["landing-page", "instagram-visual"]
          },
          prompt: "Produis une landing page structuree pour TERRA avec titre, promesse, resume, benefices, preuve/source et appel a l'action. Retourne un artefact landing-page."
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Octopus n'a pas produit la landing page.");
      const bundle = saveBundle(landingBundleFromMission(operationId, payload));
      saveStatus({ status: "waiting-authorization", error: null, operationId });
      recordTransition("Landing page produite", "Harvest landing-page creee. Canva attend une autorisation humaine.");
      render();
      return bundle;
    } catch (error) {
      saveStatus({
        status: "failed",
        error: error instanceof Error ? error.message : "Erreur Octopus",
        action: "Relancer Produire maintenant"
      });
      recordTransition("Octopus en echec", error instanceof Error ? error.message : "Erreur Octopus");
      render();
      return null;
    }
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
    recordTransition("Octopus consulte Canva", "Creation du visuel Instagram.");
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
        throw new Error(payload.error || "Aucun artefact Canva retourne.");
      }
      addVisualHarvest(bundle, payload.artifact);
      saveStatus({ status: "completed", canvaUrl: payload.artifact.url, error: null });
      recordTransition("Visuel Canva produit", payload.artifact.url);
    } catch (error) {
      saveStatus({
        status: "failed",
        error: error instanceof Error ? error.message : "Erreur Canva",
        action: "Relancer uniquement l'etape Canva"
      });
      recordTransition("Canva en echec", error instanceof Error ? error.message : "Erreur Canva");
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
    const error = status.error ? `<div class="garden-alert error"><strong>Canva</strong><span>${esc(status.error)}</span><small>${esc(status.action || "Reessayer")}</small></div>` : "";
    return `<section class="terra-canva-authorization">
      <p class="eyebrow">Autorisation Canva</p>
      <h3>Gerard a prepare le texte. Le visuel Instagram attend ton autorisation.</h3>
      <ul>
        <li>Texte de landing page : pret</li>
        <li>Contenu du visuel : ${esc(input.headline)}</li>
        <li>Outil : Canva via Publisher / Composio</li>
        <li>Action externe : creation d'un design Canva</li>
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
    if (cancel) cancel.onclick = () => { saveStatus({ status: "waiting-authorization", error: "Autorisation refusee." }); render(); };
  }

  function render() {
    const panel = document.querySelector(".production-pack") || document.querySelector(".adventure-return") || document.querySelector(".panel");
    if (!panel || document.querySelector(".terra-canva-authorization")) return;
    const html = renderPanel();
    if (html) panel.insertAdjacentHTML("afterend", html);
    bind();
  }

  global.TerraHarvestLoop = { STATUS_KEY, latestTerraBundle, landingHarvest, visualHarvest, canvaInput, produceNow, authorizeCanva, renderPanel };

  const baseRender = global.render;
  global.render = function renderWithTerraHarvestLoop() {
    baseRender();
    render();
  };
})(globalThis);
