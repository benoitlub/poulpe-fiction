(function productionPackModule(global) {
  "use strict";

  const STORE_KEY = "poulpe-fiction:production-packs:v1";
  const CONNECTION_KEY = "poulpe-fiction:production-diagnostics:v1";

  const sourceCatalog = {
    terra: {
      notion: "https://app.notion.com/p/38739119725381d68ecefd85494ebd6e",
      amazonKindle: "https://www.amazon.fr/dp/B0H49Z1K3H",
      amazonPaperback: "https://www.amazon.fr/dp/B0H4CN5MSH",
      primaryUrl: "https://www.amazon.fr/dp/B0H4CN5MSH",
      sourceStatus: "verified"
    }
  };

  function nowIso() { return new Date().toISOString(); }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[char]));
  }
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function save(pack) {
    const previous = load().filter((item) => item.id !== pack.id);
    localStorage.setItem(STORE_KEY, JSON.stringify([pack, ...previous].slice(0, 50)));
    return pack;
  }
  function activeContext() { return global.BlacklaceParcel?.activeSeed?.() || null; }
  function sourceFor(seedId) { return sourceCatalog[seedId] || { sourceStatus: "missing" }; }
  function latestForReturn(returnId) { return load().find((pack) => pack.returnId === returnId) || null; }
  function publisherBaseUrl() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
    catch (_) { return ""; }
  }
  function loadConnections() {
    try { return JSON.parse(localStorage.getItem(CONNECTION_KEY) || "null") || null; }
    catch (_) { return null; }
  }
  function saveConnections(payload) {
    const value = Object.assign({}, payload || {}, { checkedAt: nowIso() });
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(value));
    return value;
  }
  async function refreshConnections() {
    const base = publisherBaseUrl();
    if (!base) return saveConnections({ status: "inaccessible", payload: null, error: "Publisher API non configuree." });
    try {
      const response = await fetch(`${base}/api/production/diagnostics`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Diagnostic Publisher inaccessible.");
      return saveConnections({ status: "ready", payload, error: null });
    } catch (error) {
      return saveConnections({
        status: "inaccessible",
        payload: null,
        error: error instanceof Error ? error.message : "Diagnostic Publisher inaccessible."
      });
    }
  }

  function landingDocument(title, body, source) {
    const paragraphs = escapeHtml(body)
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .split(/\n{2,}/)
      .map((block) => /^<h[1-3]>/.test(block) ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`)
      .join("\n");
    const cta = source.primaryUrl
      ? `<p class="cta"><a href="${escapeHtml(source.primaryUrl)}" target="_blank" rel="noopener">Decouvrir sur Amazon</a></p>`
      : "";
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#100c12;color:#f7efe4}.page{max-width:820px;margin:auto;padding:64px 24px}h1{font-size:clamp(2.3rem,7vw,5rem);line-height:1.02}h2{margin-top:2.4rem}p{font-size:1.1rem;line-height:1.7;color:#ddd0c5}.cta a{display:inline-block;background:#ff6c3d;color:#140b07;padding:15px 22px;border-radius:999px;font-weight:900;text-decoration:none}footer{margin-top:56px;color:#998c84;font-size:.85rem}</style></head><body><main class="page">${paragraphs}${cta}<footer>Production Pack - Poulpe Fiction</footer></main></body></html>`;
  }

  function artifactFromStep(step, landingReady, title, text, source) {
    const isLanding = step.type === "landing-page";
    return {
      id: step.id,
      type: step.type,
      label: step.label,
      status: isLanding ? (landingReady ? "ready" : "missing-source") : (step.dependsOn?.length ? "blocked" : "waiting-adapter"),
      provider: step.provider,
      providerStatus: step.providerStatus,
      dependsOn: step.dependsOn || [],
      mimeType: isLanding ? "text/html" : null,
      content: isLanding && landingReady ? landingDocument(title, text, source) : null
    };
  }

  function createFromReturn(bundle) {
    if (!bundle || bundle.status !== "ready" || !bundle.harvests?.length) return null;
    const existing = latestForReturn(bundle.id);
    if (existing) return existing;
    const context = activeContext();
    const seedId = context?.seedId || bundle.rawMission?.seedId || "unknown";
    const title = context?.seedTitle || bundle.harvests[0]?.title || "Production Blacklace";
    const source = sourceFor(seedId);
    const textHarvest = bundle.harvests.find((item) => item.artifactType === "text" || item.artifactType === "landing-page") || bundle.harvests[0];
    const text = String(textHarvest?.artifact || textHarvest?.description || "");
    const landingReady = Boolean(text);
    const plan = global.ProductionPlan?.current?.();
    const planSteps = plan?.seedId === seedId ? plan.steps : [];
    const artifactSteps = planSteps.filter((step) => step.type !== "publication");
    const publicationSteps = planSteps.filter((step) => step.type === "publication" && step.id !== "tiktok-publication");

    const pack = save({
      version: 3,
      id: `production_${bundle.id}`,
      returnId: bundle.id,
      productionPlanId: plan?.id || null,
      parcelId: bundle.parcelId,
      seedId,
      title,
      createdAt: nowIso(),
      sourceManifest: source,
      status: "awaiting-production",
      artifacts: artifactSteps.length
        ? artifactSteps.map((step) => artifactFromStep(step, landingReady, title, text, source))
        : [
            artifactFromStep({ id:"landing-page", type:"landing-page", label:"Landing page", provider:"Poulpe Fiction HTML", providerStatus:"ready", dependsOn:[] }, landingReady, title, text, source),
            artifactFromStep({ id:"social-visual", type:"social-visual", label:"Visuel Instagram 1080 x 1350", provider:"Canva", providerStatus:"planned", dependsOn:["landing-page"] }, landingReady, title, text, source),
            artifactFromStep({ id:"voice-over", type:"voice-over", label:"Voix off", provider:"ElevenLabs", providerStatus:"planned", dependsOn:["landing-page"] }, landingReady, title, text, source),
            artifactFromStep({ id:"vertical-video", type:"vertical-video", label:"Video verticale 9:16", provider:"Kling ou Runway", providerStatus:"planned", dependsOn:["social-visual", "voice-over"] }, landingReady, title, text, source)
          ],
      publications: publicationSteps.length
        ? publicationSteps.map((step) => ({
            id: step.id,
            platform: step.label.replace(/^Publication\s+/i, ""),
            scheduler: step.provider,
            status: "blocked",
            dependsOn: step.dependsOn || []
          }))
        : [
            { id:"instagram-publication", platform:"Instagram", scheduler:"Metricool", status:"blocked", dependsOn:["social-visual", "vertical-video"] }
          ]
    });
    global.ProductionPlan?.updateFromProductionPack?.(pack);
    return pack;
  }

  function statusLabel(status) {
    return ({
      "to-prepare": "À préparer",
      ready: "Prêt",
      producing: "En cours",
      "authorization-required": "Autorisation requise",
      produced: "Produit",
      blocked: "Bloqué",
      failed: "Échec",
      "diagnostic-inaccessible": "Diagnostic inaccessible",
      "missing-source": "Bloque",
      "waiting-adapter": "À préparer"
    })[status] || status;
  }

  function connectionStatus(provider, connections) {
    const payload = connections?.payload || {};
    const text = String(provider || "").toLowerCase();
    if (!connections || connections.status === "inaccessible") return "Diagnostic inaccessible";
    if (/poulpe fiction|html|interne/.test(text)) return "Disponible";
    if (/canva/.test(text)) return payload.canva?.connected || payload.composio?.canvaConnected ? "Connecté" : "Non connecté";
    if (/elevenlabs|voix/.test(text)) return payload.elevenLabs?.connected || payload.composio?.elevenLabsConnected ? "Connecté" : "Non connecté";
    if (/mistral/.test(text)) return payload.mistral?.available ? "Disponible" : "Indisponible";
    if (/composio/.test(text)) return payload.composio?.configured ? "Disponible" : "Indisponible";
    return "Disponible";
  }

  function latestHarvests() {
    const bundle = global.TerraHarvestLoop?.latestTerraBundle?.();
    return {
      bundle,
      landing: global.TerraHarvestLoop?.landingHarvest?.(bundle) || null,
      visual: global.TerraHarvestLoop?.visualHarvest?.(bundle) || null
    };
  }

  function artifactStatus(artifact, connections) {
    const harvests = latestHarvests();
    if (artifact.type === "landing-page") return harvests.landing || artifact.content ? "produced" : "ready";
    if (artifact.type === "social-visual") {
      if (harvests.visual) return "produced";
      if (!harvests.landing && !artifact.content) return "blocked";
      return connectionStatus("Canva", connections) === "Connecté" ? "authorization-required" : "blocked";
    }
    if (artifact.type === "voice-over") return "to-prepare";
    if (artifact.type === "vertical-video") return "to-prepare";
    return artifact.status === "ready" ? "produced" : "to-prepare";
  }

  function producedHarvestFor(artifact) {
    const harvests = latestHarvests();
    if (artifact.type === "landing-page") return harvests.landing;
    if (artifact.type === "social-visual") return harvests.visual;
    return null;
  }

  function dataUrl(content, mimeType) {
    return `data:${mimeType || "text/plain"};charset=utf-8,${encodeURIComponent(content || "")}`;
  }

  function artifactCard(artifact, pack) {
    const connections = loadConnections();
    const status = artifactStatus(artifact, connections);
    const harvest = producedHarvestFor(artifact);
    const connection = connectionStatus(artifact.provider, connections);
    const preview = (status === "produced" || status === "ready") && artifact.content
      ? `<button class="ghost" data-production-preview="${escapeHtml(artifact.id)}">Apercu</button>` : "";
    const download = status === "produced" && artifact.content
      ? `<a class="primary production-link" download="${escapeHtml(pack.seedId)}-${escapeHtml(artifact.id)}.html" href="${dataUrl(artifact.content, artifact.mimeType)}">Telecharger</a>` : "";
    const openHarvest = harvest ? `<button class="ghost" data-open-production-harvest="${escapeHtml(harvest.id)}">Voir la recolte</button>` : "";
    const authorize = status === "authorization-required" && artifact.type === "social-visual"
      ? `<button class="primary" data-authorize-canva>Autoriser Canva</button>` : "";
    const blocked = status === "blocked"
      ? `<button class="ghost" disabled>Dependance absente</button>` : "";
    return `<article class="production-item"><div><span class="production-status">${statusLabel(status)}</span><h3>${escapeHtml(artifact.label)}</h3><p>${escapeHtml(artifact.provider)} - ${escapeHtml(connection)}</p></div><div class="play-actions">${openHarvest}${preview}${download}${authorize}${blocked}</div></article>`;
  }

  function publicationCard(publication) {
    return `<article class="production-item secondary-production"><div><span class="production-status">${statusLabel(publication.status)}</span><h3>${escapeHtml(publication.platform)}</h3><p>Programmation via ${escapeHtml(publication.scheduler)}</p></div><button class="ghost" disabled>Programmer</button></article>`;
  }

  function render(pack) {
    if (!pack) return "";
    const connections = loadConnections();
    const source = pack.sourceManifest || {};
    const sourceLinks = [
      source.notion ? `<a href="${escapeHtml(source.notion)}" target="_blank" rel="noopener">Notion</a>` : "",
      source.amazonPaperback ? `<a href="${escapeHtml(source.amazonPaperback)}" target="_blank" rel="noopener">Amazon broche</a>` : "",
      source.amazonKindle ? `<a href="${escapeHtml(source.amazonKindle)}" target="_blank" rel="noopener">Amazon Kindle</a>` : ""
    ].filter(Boolean).join(" - ");
    const connectionSummary = connections?.status === "ready"
      ? `Canva ${connectionStatus("Canva", connections)} - ElevenLabs ${connectionStatus("ElevenLabs", connections)} - Mistral ${connectionStatus("Mistral", connections)}`
      : (connections?.error || "Diagnostic non charge.");
    return `<section class="production-pack"><p class="eyebrow">Production Pack</p><div class="production-head"><div><h2>${escapeHtml(pack.title)}</h2><p>Les resultats concrets apparaissent ici. L'etat operationnel vient du diagnostic Publisher courant.</p></div><span>${escapeHtml(connectionSummary)}</span></div><div class="play-actions"><button class="primary" data-production-now>Produire maintenant</button><button class="ghost" data-open-all-harvests>Voir toutes les recoltes</button><button class="ghost" data-refresh-production-connections>Actualiser les connexions</button></div><div class="production-sources"><strong>Sources verifiees</strong><p>${sourceLinks || "Aucune source distante reliee."}</p></div><h3>Artefacts</h3><div class="production-grid">${pack.artifacts.map((item) => artifactCard(item, pack)).join("")}</div><h3>Publications</h3><div class="production-grid">${(pack.publications || []).map(publicationCard).join("")}</div></section>`;
  }

  function bind(pack) {
    const refresh = document.querySelector("[data-refresh-production-connections]");
    if (refresh) refresh.onclick = async () => { refresh.disabled = true; refresh.textContent = "Actualisation..."; await refreshConnections(); global.render?.(); };
    const produce = document.querySelector("[data-production-now]");
    if (produce) produce.onclick = () => { void global.TerraHarvestLoop?.produceNow?.(); };
    const allHarvests = document.querySelector("[data-open-all-harvests]");
    if (allHarvests) allHarvests.onclick = () => { global.GardenPersistence?.selectView?.("harvests"); };
    document.querySelectorAll("[data-open-production-harvest]").forEach((button) => {
      button.onclick = () => { global.GardenPersistence?.selectView?.("harvests"); };
    });
    document.querySelectorAll("[data-authorize-canva]").forEach((button) => {
      button.onclick = () => { void global.TerraHarvestLoop?.authorizeCanva?.(); };
    });
    document.querySelectorAll("[data-production-preview]").forEach((button) => {
      button.onclick = () => {
        const artifact = pack.artifacts.find((item) => item.id === button.dataset.productionPreview);
        if (!artifact?.content) return;
        const preview = global.open("", "_blank", "noopener,noreferrer");
        if (preview) { preview.document.open(); preview.document.write(artifact.content); preview.document.close(); }
      };
    });
  }

  global.ProductionPack = { STORE_KEY, CONNECTION_KEY, load, save, createFromReturn, latestForReturn, loadConnections, refreshConnections, connectionStatus, artifactStatus, render };

  const baseRender = global.render;
  global.render = function renderWithProductionPack() {
    baseRender();
    if (state.step !== "result") return;
    const draft = global.AdventureDraft?.load?.();
    const bundle = draft ? global.AdventureReturnProcessor?.latestForDraft?.(draft.id) : null;
    const pack = bundle ? createFromReturn(bundle) : null;
    if (!pack) return;
    const panel = root.querySelector(".panel");
    if (!panel) return;
    const html = render(pack);
    const existing = panel.querySelector(".production-pack");
    if (existing) {
      existing.outerHTML = html;
    } else {
      panel.insertAdjacentHTML("beforeend", html);
    }
    bind(pack);
    if (!loadConnections()) void refreshConnections().then(() => global.render?.());
  };
})(globalThis);
