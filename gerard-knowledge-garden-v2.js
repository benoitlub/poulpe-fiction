(function gerardKnowledgeGardenV2(global) {
  "use strict";
  const KEY = "poulpe-fiction:gerard-knowledge-garden:v2";
  const INTERVAL = 15 * 60 * 1000;
  let running = false;
  let mounted = false;
  let timer = null;
  const text = (v) => typeof v === "string" ? v.trim() : "";
  const rec = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const now = () => new Date().toISOString();
  const slug = (v) => String(v || "seed").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-+/g, "-").slice(0, 90) || `seed-${Date.now()}`;
  const garden = () => global.GardenStore?.snapshot?.() || { parcels: [], seeds: [] };
  const state = () => { try { return rec(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { return {}; } };
  const save = (patch) => { const next = { ...state(), ...patch, updatedAt: now() }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {} return next; };
  const isOwner = () => text(rec(global.PoulpeAccess?.snapshot?.()).mode) !== "client";
  const seedSlug = (seed) => text(seed.knowledgeSlug) || slug(seed.title || seed.id);

  async function loadPack(seed) {
    const requestedAt = now();
    global.GardenStore.updateSeed(seed.id, { knowledgeSlug: seedSlug(seed), knowledgeStatus: "requesting", knowledgeRequestedAt: requestedAt, knowledgeError: null });
    const pack = await global.PublisherKnowledge.load(seedSlug(seed));
    const verified = Boolean(pack?.verified && pack?.prompt);
    global.GardenStore.updateSeed(seed.id, {
      knowledgeSlug: seedSlug(seed), knowledgeStatus: verified ? "ready" : "missing", knowledgeVerified: verified,
      knowledgeSource: text(pack?.source) || null, knowledgeFetchedAt: text(pack?.fetchedAt) || requestedAt,
      knowledgeDiagnostics: pack?.diagnostics || null, knowledgeError: verified ? null : text(pack?.diagnostics?.error) || "Aucun Knowledge Pack vérifié"
    });
    return { seedId: seed.id, parcelId: seed.parcelId, verified, pack };
  }

  async function syncAll(reason = "automatic") {
    if (running || !global.GardenStore || !global.PublisherKnowledge) return [];
    running = true;
    save({ status: "running", reason, startedAt: now() });
    const seeds = garden().seeds.filter((seed) => seed?.id && !["composted", "archived"].includes(text(seed.status).toLowerCase()));
    const results = [];
    try {
      for (const seed of seeds) {
        try { results.push(await loadPack(seed)); }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          global.GardenStore.updateSeed(seed.id, { knowledgeStatus: "error", knowledgeError: message, knowledgeCheckedAt: now() });
          results.push({ seedId: seed.id, verified: false, error: message });
        }
      }
      const ready = results.filter((item) => item.verified).length;
      save({ status: "idle", completedAt: now(), total: results.length, ready, missing: results.length - ready });
      global.dispatchEvent?.(new CustomEvent("poulpe-knowledge-garden-synced", { detail: { reason, results } }));
      try { global.pushChat?.("gerard", `📚 Publisher suit maintenant ${ready}/${results.length} graine(s) avec un Knowledge Pack vérifié.`); } catch (_) {}
      return results;
    } finally { running = false; }
  }

  function scheduleSync(reason, delay = 700) {
    if (running) return;
    clearTimeout(timer);
    timer = global.setTimeout(() => void syncAll(reason), delay);
  }

  async function sendProposal(seed, parcel) {
    if (!global.PoulpeOctopusAdapter?.dispatch) return { status: "recorded-locally" };
    const operationId = `seed-proposal-${seed.id}-${Date.now()}`;
    const response = await global.PoulpeOctopusAdapter.dispatch({
      operationId, parcelId: seed.parcelId, title: `Nouvelle graine · ${seed.title}`, objective: seed.objective || seed.content,
      intent: "seed.propose", type: "seed.proposal", requiredCapabilities: ["knowledge.curate"], authorizedResources: ["publisher"], authorize: ["publisher"],
      authorizationPolicy: { internalWork: "allowed", externalAction: "requires-human-approval" },
      context: { id: seed.parcelId, label: parcel?.name || seed.parcelId, objective: seed.objective || seed.content, metadata: { owner: "poulpe-fiction", adapter: "poulpe-octopus-v1", parcelId: seed.parcelId, seedId: seed.id, knowledgeSlug: seed.knowledgeSlug, requestedCapability: "knowledge.curate", proposal: true } },
      prompt: ["Poulpe Fiction propose une nouvelle graine à Gérard.", `Parcelle: ${parcel?.name || seed.parcelId}`, `Graine: ${seed.title}`, `Objectif: ${seed.objective || seed.content}`, seed.firstHarvest ? `Première récolte souhaitée: ${seed.firstHarvest}` : "", "Octopus enregistre l'intention et demande à Publisher de préparer le Knowledge Pack. Gérard choisit ensuite le prochain travail interne.", "Toute action externe reste soumise à validation humaine."].filter(Boolean).join("\n")
    }, { kind: "seed-proposal" });
    return rec(response?.result || response);
  }

  async function proposeSeed(input) {
    const data = garden();
    const parcelId = text(input?.parcelId) || data.activeParcelId || data.parcels[0]?.id;
    const parcel = data.parcels.find((item) => item.id === parcelId);
    const title = text(input?.title), objective = text(input?.objective);
    if (!parcel) throw new Error("Choisis une parcelle valide");
    if (!title || !objective) throw new Error("Le nom et l'objectif de la graine sont nécessaires");
    const root = slug(title); let id = root, n = 2;
    while (data.seeds.some((seed) => seed.id === id)) id = `${root}-${n++}`;
    const seed = global.GardenStore.plantSeed({ id, parcelId, title, objective, content: objective, kind: text(input?.kind) || "idea", firstHarvest: text(input?.firstHarvest) || "Une première récolte concrète proposée par Gérard", source: "poulpe-fiction-proposal", status: "proposed", plantedBy: "benoit", gardener: "gerard", knowledgeSlug: slug(title), proposedAt: now() });
    global.GardenStore.activateSeed(parcelId, seed.id);
    global.GardenStore.updateSeed(seed.id, { autonomyStatus: "consulting-publisher" });
    let dispatchResult;
    try {
      dispatchResult = await sendProposal(seed, parcel);
      global.GardenStore.updateSeed(seed.id, { autonomyStatus: "proposed-to-gerard", proposalOperationId: text(dispatchResult.operationId) || text(dispatchResult.missionId) || null, proposalStatus: text(dispatchResult.status) || "accepted" });
    } catch (error) {
      global.GardenStore.updateSeed(seed.id, { autonomyStatus: "proposal-recorded", proposalError: error instanceof Error ? error.message : String(error) });
    }
    await loadPack(seed);
    try { global.pushChat?.("gerard", `🌱 « ${title} » est plantée dans ${parcel.name || parcel.id}. Publisher prépare son dossier.`); } catch (_) {}
    return { seed: garden().seeds.find((item) => item.id === seed.id), dispatchResult };
  }

  function mountUi() {
    if (mounted || !isOwner() || !document.body) return;
    mounted = true;
    const host = document.createElement("div"); host.id = "gerardSeedProposal";
    host.innerHTML = `<style>#gerardSeedProposal{position:fixed;right:16px;bottom:92px;z-index:10000;font-family:Inter,system-ui,sans-serif}#gerardSeedProposal button{font:inherit}.gsp-open{border:0;border-radius:999px;padding:12px 16px;background:#7fe0d0;color:#062018;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.35)}.gsp-panel{display:none;position:absolute;right:0;bottom:54px;width:min(360px,calc(100vw - 32px));padding:16px;border-radius:20px;background:#11162d;color:#eef1ff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 60px rgba(0,0,0,.55)}.gsp-panel[data-open=true]{display:block}.gsp-panel h3{margin:0 0 4px;font-family:Georgia,serif}.gsp-panel p{margin:0 0 12px;color:#a9b0cc;font-size:13px}.gsp-panel label{display:grid;gap:5px;margin:9px 0;font-size:12px;color:#cdd4ef}.gsp-panel input,.gsp-panel textarea,.gsp-panel select{box-sizing:border-box;width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#090d1d;color:#eef1ff;padding:10px 11px}.gsp-panel textarea{min-height:76px;resize:vertical}.gsp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.gsp-actions button{border:0;border-radius:999px;padding:9px 13px}.gsp-cancel{background:rgba(255,255,255,.08);color:#eef1ff}.gsp-submit{background:#7fe0d0;color:#062018;font-weight:800}.gsp-status{min-height:18px;color:#f6c26b!important}</style><button class="gsp-open" type="button">＋ Proposer une graine</button><form class="gsp-panel" data-open="false"><h3>Une nouvelle graine pour Gérard</h3><p>Plantée dans le Garden, envoyée à Octopus, documentée par Publisher.</p><label>Parcelle<select name="parcelId"></select></label><label>Nom<input name="title" required></label><label>Ce qu'elle doit faire pousser<textarea name="objective" required></textarea></label><label>Première récolte souhaitée<input name="firstHarvest"></label><p class="gsp-status" aria-live="polite"></p><div class="gsp-actions"><button class="gsp-cancel" type="button">Annuler</button><button class="gsp-submit" type="submit">Confier à Gérard</button></div></form>`;
    document.body.appendChild(host);
    const panel = host.querySelector("form"), select = host.querySelector("select"), status = host.querySelector(".gsp-status");
    const refresh = () => { const data = garden(); select.innerHTML = data.parcels.filter((p) => !p.archived).map((p) => `<option value="${String(p.id).replace(/"/g, "&quot;")}">${String(p.name || p.id).replace(/</g, "&lt;")}</option>`).join(""); if (data.activeParcelId) select.value = data.activeParcelId; };
    host.querySelector(".gsp-open").onclick = () => { refresh(); panel.dataset.open = panel.dataset.open === "true" ? "false" : "true"; };
    host.querySelector(".gsp-cancel").onclick = () => { panel.dataset.open = "false"; };
    panel.onsubmit = async (event) => { event.preventDefault(); const form = new FormData(panel); status.textContent = "Gérard plante et consulte Publisher…"; try { const result = await proposeSeed({ parcelId: form.get("parcelId"), title: form.get("title"), objective: form.get("objective"), firstHarvest: form.get("firstHarvest") }); status.textContent = `🌱 ${result.seed?.title || "La graine"} est dans le jardin.`; panel.reset(); refresh(); global.setTimeout(() => { panel.dataset.open = "false"; status.textContent = ""; }, 1800); } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); } };
  }

  global.GerardKnowledgeGarden = { KEY, syncAll, proposeSeed, mountUi, seedSlug };
  global.setTimeout(() => void syncAll("startup"), 1200);
  global.setInterval(() => void syncAll("scheduled"), INTERVAL);
  global.addEventListener("poulpe-garden-changed", () => { if (!running) scheduleSync("garden-changed"); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { mountUi(); const last = Date.parse(text(state().completedAt) || "0") || 0; if (Date.now() - last > INTERVAL) scheduleSync("wake-up", 100); } });
  global.addEventListener("load", mountUi, { once: true }); global.setTimeout(mountUi, 300);
})(globalThis);
