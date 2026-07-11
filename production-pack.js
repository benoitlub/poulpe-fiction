(function productionPackModule(global) {
  "use strict";

  const STORE_KEY = "poulpe-fiction:production-packs:v1";

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
    return String(value || "").replace(/[&<>\"']/g, (char) => ({
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
      ? `<p class="cta"><a href="${escapeHtml(source.primaryUrl)}" target="_blank" rel="noopener">Découvrir sur Amazon</a></p>`
      : "";
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#100c12;color:#f7efe4}.page{max-width:820px;margin:auto;padding:64px 24px}h1{font-size:clamp(2.3rem,7vw,5rem);line-height:1.02}h2{margin-top:2.4rem}p{font-size:1.1rem;line-height:1.7;color:#ddd0c5}.cta a{display:inline-block;background:#ff6c3d;color:#140b07;padding:15px 22px;border-radius:999px;font-weight:900;text-decoration:none}footer{margin-top:56px;color:#998c84;font-size:.85rem}</style></head><body><main class="page">${paragraphs}${cta}<footer>Production Pack · Poulpe Fiction</footer></main></body></html>`;
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
    const textHarvest = bundle.harvests.find((item) => item.artifactType === "text") || bundle.harvests[0];
    const text = String(textHarvest?.artifact || textHarvest?.description || "");
    const landingReady = Boolean(text);
    const plan = global.ProductionPlan?.current?.();
    const planSteps = plan?.seedId === seedId ? plan.steps : [];
    const artifactSteps = planSteps.filter((step) => step.type !== "publication");
    const publicationSteps = planSteps.filter((step) => step.type === "publication");

    const pack = save({
      version: 2,
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
            artifactFromStep({ id:"social-visual", type:"social-visual", label:"Visuel Instagram 1080 × 1350", provider:"Canva ou générateur d’image", providerStatus:"planned", dependsOn:["landing-page"] }, landingReady, title, text, source),
            artifactFromStep({ id:"voice-over", type:"voice-over", label:"Voix off", provider:"ElevenLabs", providerStatus:"planned", dependsOn:["landing-page"] }, landingReady, title, text, source),
            artifactFromStep({ id:"vertical-video", type:"vertical-video", label:"Vidéo verticale 9:16", provider:"Kling ou Runway", providerStatus:"planned", dependsOn:["social-visual", "voice-over"] }, landingReady, title, text, source)
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
            { id:"instagram-publication", platform:"Instagram", scheduler:"Metricool", status:"blocked", dependsOn:["social-visual", "vertical-video"] },
            { id:"tiktok-publication", platform:"TikTok", scheduler:"Metricool", status:"blocked", dependsOn:["vertical-video"] }
          ]
    });
    global.ProductionPlan?.updateFromProductionPack?.(pack);
    return pack;
  }

  function statusLabel(status) {
    return ({
      ready: "✅ Prêt",
      producing: "🟡 En production",
      "waiting-adapter": "🔌 Adaptateur à brancher",
      blocked: "⏳ En attente",
      "missing-source": "❓ Source manquante"
    })[status] || status;
  }

  function dataUrl(content, mimeType) {
    return `data:${mimeType || "text/plain"};charset=utf-8,${encodeURIComponent(content || "")}`;
  }

  function artifactCard(artifact, pack) {
    const preview = artifact.status === "ready" && artifact.content
      ? `<button class="ghost" data-production-preview="${escapeHtml(artifact.id)}">Aperçu</button>` : "";
    const download = artifact.status === "ready" && artifact.content
      ? `<a class="primary production-link" download="${escapeHtml(pack.seedId)}-${escapeHtml(artifact.id)}.html" href="${dataUrl(artifact.content, artifact.mimeType)}">Télécharger</a>` : "";
    const waiting = artifact.status === "waiting-adapter" || artifact.status === "blocked"
      ? `<button class="ghost" disabled title="Le connecteur externe n’est pas encore configuré">${artifact.status === "blocked" ? "Dépendances en attente" : `Brancher ${escapeHtml(artifact.provider)}`}</button>` : "";
    return `<article class="production-item"><div><span class="production-status">${statusLabel(artifact.status)}</span><h3>${escapeHtml(artifact.label)}</h3><p>${escapeHtml(artifact.provider)}</p></div><div class="play-actions">${preview}${download}${waiting}</div></article>`;
  }

  function publicationCard(publication) {
    return `<article class="production-item"><div><span class="production-status">${statusLabel(publication.status)}</span><h3>${escapeHtml(publication.platform)}</h3><p>Programmation via ${escapeHtml(publication.scheduler)}</p></div><button class="ghost" disabled>Programmer</button></article>`;
  }

  function render(pack) {
    if (!pack) return "";
    const source = pack.sourceManifest || {};
    const sourceLinks = [
      source.notion ? `<a href="${escapeHtml(source.notion)}" target="_blank" rel="noopener">Notion</a>` : "",
      source.amazonPaperback ? `<a href="${escapeHtml(source.amazonPaperback)}" target="_blank" rel="noopener">Amazon broché</a>` : "",
      source.amazonKindle ? `<a href="${escapeHtml(source.amazonKindle)}" target="_blank" rel="noopener">Amazon Kindle</a>` : ""
    ].filter(Boolean).join(" · ");
    const plan = global.ProductionPlan?.current?.();
    const planHtml = plan ? global.ProductionPlan.render(plan) : "";
    return `${planHtml}<section class="production-pack"><p class="eyebrow">📦 Production Pack</p><div class="production-head"><div><h2>${escapeHtml(pack.title)}</h2><p>Les résultats concrets apparaissent ici. Un statut honnête remplace désormais les livrables imaginaires.</p></div><span>${escapeHtml(pack.status)}</span></div><div class="production-sources"><strong>Sources vérifiées</strong><p>${sourceLinks || "Aucune source distante reliée."}</p></div><h3>Artefacts</h3><div class="production-grid">${pack.artifacts.map((item) => artifactCard(item, pack)).join("")}</div><h3>Publications</h3><div class="production-grid">${pack.publications.map(publicationCard).join("")}</div></section>`;
  }

  function bind(pack) {
    document.querySelectorAll("[data-production-preview]").forEach((button) => {
      button.onclick = () => {
        const artifact = pack.artifacts.find((item) => item.id === button.dataset.productionPreview);
        if (!artifact?.content) return;
        const preview = global.open("", "_blank", "noopener,noreferrer");
        if (preview) { preview.document.open(); preview.document.write(artifact.content); preview.document.close(); }
      };
    });
  }

  global.ProductionPack = { STORE_KEY, load, save, createFromReturn, latestForReturn, render };

  const baseRender = global.render;
  global.render = function renderWithProductionPack() {
    baseRender();
    if (state.step !== "result") return;
    const draft = global.AdventureDraft?.load?.();
    const bundle = draft ? global.AdventureReturnProcessor?.latestForDraft?.(draft.id) : null;
    const pack = bundle ? createFromReturn(bundle) : null;
    if (!pack) return;
    const panel = root.querySelector(".panel");
    if (panel && !panel.querySelector(".production-pack")) panel.insertAdjacentHTML("beforeend", render(pack));
    bind(pack);
  };
})(globalThis);
