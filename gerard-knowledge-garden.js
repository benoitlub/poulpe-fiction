(function gerardKnowledgeGardenModule(global) {
  "use strict";

  const STATE_KEY = "poulpe-fiction:gerard-knowledge-garden:v1";
  const SYNC_INTERVAL_MS = 15 * 60 * 1000;
  const RETRY_MS = 45 * 1000;
  let syncing = false;
  let rerunRequested = false;
  let uiMounted = false;

  function now() { return new Date().toISOString(); }
  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function slug(value) {
    return String(value || "seed")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").replace(/-+/g, "-").slice(0, 90) || `seed-${Date.now()}`;
  }
  function readState() {
    try { return record(JSON.parse(localStorage.getItem(STATE_KEY) || "{}")); }
    catch (_) { return {}; }
  }
  function writeState(patch) {
    const next = { ...readState(), ...patch, updatedAt: now() };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function ownerMode() {
    const access = record(global.PoulpeAccess?.snapshot?.());
    return text(access.mode) !== "client";
  }
  function snapshot() {
    return global.GardenStore?.snapshot?.() || { parcels: [], seeds: [] };
  }
  function parcelFor(seed, data) {
    return data.parcels.find((parcel) => parcel.id === seed.parcelId) || null;
  }
  function eligible(seed) {
    return seed && seed.id && !["composted", "archived"].includes(text(seed.status).toLowerCase());
  }
  function knowledgeSlug(seed) {
    return text(seed.knowledgeSlug) || slug(seed.title || seed.id);
  }

  async function requestPack(seed, data) {
    const parcel = parcelFor(seed, data);
    const requestedAt = now();
    global.GardenStore?.updateSeed?.(seed.id, {
      knowledgeSlug: knowledgeSlug(seed),
      knowledgeStatus: "requesting",
      knowledgeRequestedAt: requestedAt,
      knowledgeError: null,
    });

    const pack = await global.PublisherKnowledge?.load?.(knowledgeSlug(seed));
    const verified = Boolean(pack?.verified && pack?.prompt);
    global.GardenStore?.updateSeed?.(seed.id, {
      knowledgeSlug: knowledgeSlug(seed),
      knowledgeStatus: verified ? "ready" : "missing",
      knowledgeVerified: verified,
      knowledgeSource: text(pack?.source) || null,
      knowledgeFetchedAt: text(pack?.fetchedAt) || requestedAt,
      knowledgeDiagnostics: pack?.diagnostics || null,
      knowledgeError: verified ? null : text(pack?.diagnostics?.error) || "Aucun Knowledge Pack vérifié",
    });

    global.dispatchEvent?.(new CustomEvent("poulpe-knowledge-pack-updated", {
      detail: { seedId: seed.id, parcelId: seed.parcelId, parcelName: parcel?.name || seed.parcelId, pack },
    }));
    return { seedId: seed.id, verified, pack };
  }

  async function syncAll(reason) {
    if (syncing) { rerunRequested = true; return []; }
    if (!global.GardenStore || !global.PublisherKnowledge) return [];
    syncing = true;
    rerunRequested = false;
    const startedAt = now();
    writeState({ status: "running", reason: reason || "automatic", startedAt });
    const data = snapshot();
    const seeds = data.seeds.filter(eligible);
    const results = [];

    try {
      for (const seed of seeds) {
        try { results.push(await requestPack(seed, data)); }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          global.GardenStore?.updateSeed?.(seed.id, { knowledgeStatus: "error", knowledgeError: message, knowledgeCheckedAt: now() });
          results.push({ seedId: seed.id, verified: false, error: message });
        }
      }
      const ready = results.filter((item) => item.verified).length;
      writeState({ status: "idle", completedAt: now(), total: results.length, ready, missing: results.length - ready });
      try { global.pushChat?.("gerard", `📚 Publisher a préparé ${ready}/${results.length} Knowledge Pack(s) du jardin.`); } catch (_) {}
      global.dispatchEvent?.(new CustomEvent("poulpe-knowledge-garden-synced", { detail: { reason, results } }));
      return results;
    } finally {
      syncing = false;
      if (rerunRequested) global.setTimeout(() => void syncAll("garden-changed"), 400);
    }
  }

  async function dispatchSeedProposal(seed, parcel) {
    const runtime = global.PoulpeOctopusAdapter;
    if (!runtime?.dispatch) return { status: "recorded-locally" };
    const operationId = `seed-proposal-${seed.id}-${Date.now()}`;
    const response = await runtime.dispatch({
      operationId,
      parcelId: seed.parcelId,
      title: `Nouvelle graine · ${seed.title}`,
      objective: seed.objective || seed.content,
      intent: "seed.propose",
      type: "seed.proposal",
      requiredCapabilities: ["knowledge.curate"],
      authorizedResources: ["publisher"],
      authorize: ["publisher"],
      authorizationPolicy: { internalWork: "allowed", externalAction: "requires-human-approval" },
      context: {
        id: seed.parcelId,
        label: parcel?.name || seed.parcelId,
        objective: seed.objective || seed.content,
        metadata: {
          owner: "poulpe-fiction",
          adapter: "poulpe-octopus-v1",
          parcelId: seed.parcelId,
          seedId: seed.id,
          knowledgeSlug: seed.knowledgeSlug,
          requestedCapability: "knowledge.curate",
          proposal: true,
        },
      },
      prompt: [
        "Poulpe Fiction propose une nouvelle graine à Gérard.",
        `Parcelle: ${parcel?.name || seed.parcelId}`,
        `Graine: ${seed.title}`,
        `Objectif: ${seed.objective || seed.content}`,
        seed.firstHarvest ? `Première récolte souhaitée: ${seed.firstHarvest}` : "",
        "Octopus doit enregistrer l'intention, demander à Publisher de préparer le Knowledge Pack et laisser Gérard décider du prochain travail interne.",
        "Aucune publication, dépense ou prise de contact externe n'est autorisée sans validation humaine.",
      ].filter(Boolean).join("\n"),
    }, { kind: "seed-proposal" });
    return record(response?.result || response);
  }

  async function proposeSeed(input) {
    if (!global.GardenStore) throw new Error("GardenStore indisponible");
    const data = snapshot();
    const parcelId = text(input?.parcelId) || data.activeParcelId || data.parcels[0]?.id;
    const parcel = data.parcels.find((item) => item.id === parcelId);
    if (!parcel) throw new Error("Choisis une parcelle valide");
    const title = text(input?.title);
    const objective = text(input?.objective);
    if (!title || !objective) throw new Error("Le nom et l'objectif de la graine sont nécessaires");
    const baseId = slug(title);
    let id = baseId;
    let suffix = 2;
    while (data.seeds.some((seed) => seed.id === id)) id = `${baseId}-${suffix++}`;

    const seed = global.GardenStore.plantSeed({
      id,
      parcelId,
      title,
      objective,
      content: objective,
      kind: text(input?.kind) || "idea",
      firstHarvest: text(input?.firstHarvest) || "Une première récolte concrète proposée par Gérard",
      tags: Array.isArray(input?.tags) ? input.tags.map(String) : [],
      source: "poulpe-fiction-proposal",
      status: "proposed",
      plantedBy: "benoit",
      gardener: "gerard",
      knowledgeSlug: slug(title),
      proposedAt: now(),
    });

    global.GardenStore.activateSeed(parcelId, seed.id);
    global.GardenStore.updateSeed(seed.id, { autonomyStatus: "consulting-publisher" });
    let dispatchResult = null;
    try {
      dispatchResult = await dispatchSeedProposal(seed, parcel);
      global.GardenStore.updateSeed(seed.id, {
        autonomyStatus: "proposed-to-gerard",
        proposalOperationId: text(dispatchResult?.operationId) || text(dispatchResult?.missionId) || null,
        proposalStatus: text(dispatchResult?.status) || "accepted",
      });
    } catch (error) {
      global.GardenStore.updateSeed(seed.id, { autonomyStatus: "proposal-recorded", proposalError: error instanceof Error ? error.message : String(error) });
    }
    await requestPack(seed, snapshot());
    try { global.pushChat?.("gerard", `🌱 J'ai reçu « ${title} ». Je l'ai plantée dans ${parcel.name || parcel.id} et Publisher prépare son dossier.`); } catch (_) {}
    return { seed: global.GardenStore.snapshot().seeds.find((item) => item.id === seed.id), dispatchResult };
  }

  function mountUi() {
    if (uiMounted || !ownerMode() || !document.body) return;
    uiMounted = true;
    const host = document.createElement("div");
    host.id = "gerardSeedProposal";
    host.innerHTML = `<style>
      #gerardSeedProposal{position:fixed;right:16px;bottom:92px;z-index:10000;font-family:Inter,system-ui,sans-serif}
      #gerardSeedProposal button{font:inherit}.gsp-open{border:0;border-radius:999px;padding:12px 16px;background:#7fe0d0;color:#062018;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.35)}
      .gsp-panel{display:none;position:absolute;right:0;bottom:54px;width:min(360px,calc(100vw - 32px));padding:16px;border-radius:20px;background:#11162d;color:#eef1ff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 60px rgba(0,0,0,.55)}
      .gsp-panel[data-open=true]{display:block}.gsp-panel h3{margin:0 0 4px;font-family:Georgia,serif}.gsp-panel p{margin:0 0 12px;color:#a9b0cc;font-size:13px}.gsp-panel label{display:grid;gap:5px;margin:9px 0;font-size:12px;color:#cdd4ef}.gsp-panel input,.gsp-panel textarea,.gsp-panel select{box-sizing:border-box;width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#090d1d;color:#eef1ff;padding:10px 11px}.gsp-panel textarea{min-height:76px;resize:vertical}.gsp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.gsp-actions button{border:0;border-radius:999px;padding:9px 13px}.gsp-cancel{background:rgba(255,255,255,.08);color:#eef1ff}.gsp-submit{background:#7fe0d0;color:#062018;font-weight:800}.gsp-status{min-height:18px;color:#f6c26b!important}
    </style>
    <button class="gsp-open" type="button">＋ Proposer une graine</button>
    <form class="gsp-panel" data-open="false">
      <h3>Une nouvelle graine pour Gérard</h3><p>Elle sera plantée, envoyée à Octopus et documentée par Publisher.</p>
      <label>Parcelle<select name="parcelId"></select></label>
      <label>Nom de la graine<input name="title" required placeholder="Ex. Campagne Neverland volume 2"></label>
      <label>Ce qu'elle doit faire pousser<textarea name="objective" required placeholder="Décris le résultat recherché"></textarea></label>
      <label>Première récolte souhaitée<input name="firstHarvest" placeholder="Facultatif"></label>
      <p class="gsp-status" aria-live="polite"></p>
      <div class="gsp-actions"><button class="gsp-cancel" type="button">Annuler</button><button class="gsp-submit" type="submit">Confier à Gérard</button></div>
    </form>`;
    document.body.appendChild(host);
    const panel = host.querySelector(".gsp-panel");
    const select = host.querySelector("select");
    const status = host.querySelector(".gsp-status");
    function refreshParcels() {
      const data = snapshot();
      select.innerHTML = data.parcels.filter((parcel) => !parcel.archived).map((parcel) => `<option value="${String(parcel.id).replace(/"/g, "&quot;")}">${String(parcel.name || parcel.id).replace(/</g, "&lt;")}</option>`).join("");
      if (data.activeParcelId) select.value = data.activeParcelId;
    }
    host.querySelector(".gsp-open").onclick = () => { refreshParcels(); panel.dataset.open = panel.dataset.open === "true" ? "false" : "true"; };
    host.querySelector(".gsp-cancel").onclick = () => { panel.dataset.open = "false"; };
    panel.onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(panel);
      status.textContent = "Gérard plante la graine et consulte Publisher…";
      try {
        const result = await proposeSeed({ parcelId: form.get("parcelId"), title: form.get("title"), objective: form.get("objective"), firstHarvest: form.get("firstHarvest") });
        status.textContent = `🌱 ${result.seed?.title || "La graine"} est dans le jardin.`;
        panel.reset(); refreshParcels();
        global.setTimeout(() => { panel.dataset.open = "false"; status.textContent = ""; }, 1800);
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    };
  }

  function schedule() {
    global.setTimeout(() => void syncAll("startup"), 1200);
    global.setInterval(() => void syncAll("scheduled"), SYNC_INTERVAL_MS);
    global.addEventListener("poulpe-garden-changed", () => {
      const state = readState();
      const last = Date.parse(text(state.completedAt) || "0") || 0;
      if (Date.now() - last > RETRY_MS) global.setTimeout(() => void syncAll("garden-changed"), 800);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        mountUi();
        const state = readState();
        const last = Date.parse(text(state.completedAt) || "0") || 0;
        if (Date.now() - last > SYNC_INTERVAL_MS) void syncAll("wake-up");
      }
    });
    global.addEventListener("load", mountUi, { once: true });
    global.setTimeout(mountUi, 300);
  }

  global.GerardKnowledgeGarden = { STATE_KEY, syncAll, proposeSeed, mountUi, knowledgeSlug };
  schedule();
})(globalThis);
