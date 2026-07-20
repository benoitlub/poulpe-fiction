(function gerardKnowledgeGardenV3(global) {
  "use strict";
  const KEY = "poulpe-fiction:gerard-knowledge-garden:v3";
  const INTERVAL = 60 * 60 * 1000;
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const now = () => new Date().toISOString();
  const slug = (value) => String(value || "seed").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-+/g, "-").slice(0, 90);
  const garden = () => global.GardenStore?.snapshot?.() || { parcels: [], seeds: [] };
  let running = false;
  let timer = null;

  function seedSlug(seed) {
    const parcel = garden().parcels.find((item) => item.id === seed?.parcelId);
    return text(parcel?.knowledgeSlug) || slug(parcel?.name || parcel?.id || seed?.title || seed?.id);
  }

  function candidates() {
    const data = garden();
    const live = data.seeds.filter((seed) => seed?.id && !["composted", "archived"].includes(text(seed.status).toLowerCase()));
    const priority = live.filter((seed) => seed.parcelId === data.activeParcelId || ["proposed", "growing", "active"].includes(text(seed.status).toLowerCase()));
    return (priority.length ? priority : live).slice(0, 4);
  }

  async function loadPack(seed, forceRefresh = false) {
    const knowledgeSlug = seedSlug(seed);
    global.GardenStore.updateSeed(seed.id, { knowledgeSlug, knowledgeStatus: "requesting", knowledgeError: null });
    const pack = await global.PublisherKnowledge.load(knowledgeSlug, { forceRefresh });
    const verified = Boolean(pack?.verified && pack?.prompt);
    global.GardenStore.updateSeed(seed.id, {
      knowledgeSlug,
      knowledgeStatus: verified ? "ready" : "missing",
      knowledgeVerified: verified,
      knowledgeSource: text(pack?.source) || null,
      knowledgeFetchedAt: text(pack?.fetchedAt) || now(),
      knowledgeDiagnostics: pack?.diagnostics || null,
      knowledgeError: verified ? null : text(pack?.diagnostics?.error) || "Aucun dossier vérifié"
    });
    return { seedId: seed.id, parcelId: seed.parcelId, verified, pack };
  }

  async function syncAll(reason = "automatic", options = {}) {
    if (running || !global.GardenStore || !global.PublisherKnowledge) return [];
    running = true;
    const results = [];
    try {
      for (const seed of candidates()) {
        try { results.push(await loadPack(seed, Boolean(options.forceRefresh))); }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          global.GardenStore.updateSeed(seed.id, { knowledgeStatus: "error", knowledgeError: message, knowledgeCheckedAt: now() });
          results.push({ seedId: seed.id, verified: false, error: message });
        }
      }
      try { localStorage.setItem(KEY, JSON.stringify({ status: "idle", reason, completedAt: now(), total: results.length, ready: results.filter((item) => item.verified).length })); } catch (_) {}
      global.dispatchEvent?.(new CustomEvent("poulpe-knowledge-garden-synced", { detail: { reason, results } }));
      return results;
    } finally {
      running = false;
    }
  }

  function schedule(reason, delay = 2000) {
    if (running) return;
    clearTimeout(timer);
    timer = global.setTimeout(() => void syncAll(reason), delay);
  }

  async function proposeSeed(input) {
    const data = garden();
    const parcelId = text(input?.parcelId) || data.activeParcelId || data.parcels[0]?.id;
    const parcel = data.parcels.find((item) => item.id === parcelId);
    const title = text(input?.title);
    const objective = text(input?.objective);
    if (!parcel) throw new Error("Choisis une parcelle valide");
    if (!title || !objective) throw new Error("Le nom et l'objectif de la graine sont nécessaires");
    const root = slug(title) || `seed-${Date.now()}`;
    let id = root;
    let suffix = 2;
    while (data.seeds.some((seed) => seed.id === id)) id = `${root}-${suffix++}`;
    const knowledgeSlug = text(parcel.knowledgeSlug) || slug(parcel.name || parcel.id);
    const seed = global.GardenStore.plantSeed({
      id, parcelId, title, objective, content: objective,
      kind: text(input?.kind) || "idea",
      firstHarvest: text(input?.firstHarvest) || "Une première récolte concrète proposée par Gérard",
      source: "poulpe-fiction-proposal", status: "proposed", plantedBy: "benoit", gardener: "gerard", knowledgeSlug, proposedAt: now()
    });
    global.GardenStore.activateSeed(parcelId, seed.id);
    global.GardenStore.updateSeed(seed.id, { autonomyStatus: "recorded-locally" });
    await loadPack(seed, false);
    try { global.pushChat?.("gerard", `🌱 « ${title} » est plantée dans ${parcel.name || parcel.id}.`); } catch (_) {}
    return { seed: garden().seeds.find((item) => item.id === seed.id), dispatchResult: { status: "recorded-locally" } };
  }

  global.GerardKnowledgeGarden = { KEY, syncAll, proposeSeed, seedSlug };
  global.setTimeout(() => void syncAll("startup"), 800);
  global.setInterval(() => void syncAll("scheduled"), INTERVAL);
  global.addEventListener("poulpe-garden-changed", () => schedule("garden-changed"));
})(globalThis);
