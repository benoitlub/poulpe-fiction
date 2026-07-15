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

  function htmlDownloadUrl(content) {
    const html = String(content || "");
    if (!html.trim()) return null;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }

  function landingText(landing) {
    return String(landing?.content?.text || landing?.artifact?.content || landing?.artifact || landing?.description || "");
  }

  function extractProductionArtifact(payload) {
    const artifact = payload?.artifact || payload?.artifacts?.[0] || payload;
    const content = String(
      artifact?.content ||
      artifact?.text ||
      payload?.content ||
      "Landing page TERRA\n\nTERRA est prete a etre presente avec une page claire, une promesse lisible et un appel a l'action vers la decouverte du livre."
    );
    return {
      id: artifact?.id || `landing_${Date.now()}`,
      title: artifact?.title || "Landing page TERRA",
      content,
      type: artifact?.type || "landing-page.html",
      url: artifact?.url || null,
      downloadUrl: artifact?.downloadUrl || htmlDownloadUrl(content),
      mimeType: artifact?.mimeType || "text/html",
      raw: artifact || null
    };
  }

  function currentDraft() {
    return global.AdventureDraft?.load?.() || null;
  }

  function landingBundleFromProduction(operationId, payload) {
    const draft = currentDraft();
    const artifact = extractProductionArtifact(payload);
    const text = artifact.content;
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
        title: artifact.title,
        description: text.slice(0, 240),
        artifactType: "landing-page",
        artifact: {
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          content: artifact.content,
          url: artifact.url,
          downloadUrl: artifact.downloadUrl,
          mimeType: artifact.mimeType
        },
        content: { text },
        payload: payload?.plan ? { plan: payload.plan, producer: payload.tool || "html-local" } : artifact.raw,
        url: artifact.url,
        downloadUrl: artifact.downloadUrl,
        status: "ready",
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
    const base = publisherBaseUrl();
    if (!base) {
      saveStatus({ status: "failed", error: "Publisher API indisponible.", action: "Verifier le Local technique" });
      recordTransition("Publisher bloque", "Aucune URL Publisher disponible pour Production Engine.");
      render();
      return null;
    }

    const operationId = `terra_production_${Date.now()}`;
    saveStatus({ status: "running", error: null, operationId });
    recordTransition("Publisher prepare", "Production Engine genere la landing page HTML TERRA.");
    render();

    try {
      const response = await fetch(`${base}/api/production/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          requestId: operationId,
          tool: "html-local",
          action: "create_landing_page",
          capability: "landing-page",
          context: { parcelId: "blacklace-ecosystem", seedId: "terra" },
          input: {
            title: "TERRA",
            objective: "Creer une landing page exploitable pour presenter TERRA.",
            callToAction: "Decouvrir TERRA"
          }
        })
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "completed" || !payload.artifact?.content) {
        throw new Error(payload?.error || "Production Engine n'a pas produit la landing page HTML.");
      }
      const bundle = saveBundle(landingBundleFromProduction(operationId, payload));
      saveStatus({ status: "waiting-authorization", error: null, operationId });
      recordTransition("Landing page HTML produite", "Harvest landing-page creee avec fichier telechargeable.");
      render();
      return bundle;
    } catch (error) {
      saveStatus({
        status: "failed",
        error: error instanceof Error ? error.message : "Erreur Production Engine",
        action: "Relancer Produire maintenant"
      });
      recordTransition("Production Engine en echec", error instanceof Error ? error.message : "Erreur Production Engine");
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
          input: canvaInput(landingText(landing))
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
    const text = landingText(landing);
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
