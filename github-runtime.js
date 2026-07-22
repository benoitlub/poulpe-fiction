(function githubRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:github-pending:v5";
  const PROCESSED_KEY = "poulpe-fiction:github-processed:v5";
  const FEED_URL = "https://raw.githubusercontent.com/benoitlub/blacklace-publisher-ai/main/harvest-feed/latest.json";
  const POLL_MS = 60 * 1000;

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const cut = (value, limit) => text(value).slice(0, limit);

  function compactMission(payload) {
    const context = record(payload?.context);
    const metadata = record(context.metadata);
    return {
      operationId: text(payload?.operationId) || `poulpe_${Date.now()}`,
      title: cut(payload?.title, 180) || "Mission Gérard",
      objective: cut(payload?.objective || payload?.intent, 900),
      requiredCapabilities: Array.isArray(payload?.requiredCapabilities) ? payload.requiredCapabilities.slice(0, 8).map(String) : [],
      authorizedResources: Array.isArray(payload?.authorizedResources) ? payload.authorizedResources.slice(0, 8).map(String) : ["publisher"],
      parcelId: text(payload?.parcelId) || text(context.id) || "poulpe-fiction",
      context: {
        id: text(context.id) || text(payload?.parcelId) || "poulpe-fiction",
        label: cut(context.label, 120),
        metadata: {
          parcelId: text(metadata.parcelId) || text(payload?.parcelId) || text(context.id),
          seedId: text(metadata.seedId) || text(payload?.seedId),
          knowledgeSlug: text(metadata.knowledgeSlug),
          requestedCapability: text(metadata.requestedCapability),
          expectedHarvest: cut(metadata.expectedHarvest, 300),
          platform: text(metadata.platform),
          trigger: "poulpe-fiction-local-cultivation"
        }
      },
      prompt: cut(payload?.prompt, 2600)
    };
  }

  function missionSeed(payload) {
    const snapshot = global.GardenStore?.snapshot?.() || {};
    const seeds = Array.isArray(snapshot.seeds) ? snapshot.seeds : [];
    const parcelId = text(payload?.parcelId) || text(payload?.context?.id);
    const metadata = record(payload?.context?.metadata);
    const explicitSeedId = text(payload?.seedId) || text(metadata.seedId);
    if (explicitSeedId) {
      const explicit = seeds.find((seed) => text(seed.id) === explicitSeedId);
      if (explicit) return explicit;
    }
    const inParcel = seeds.filter((seed) => text(seed.parcelId) === parcelId);
    if (inParcel.length === 1) return inParcel[0];
    const haystack = `${text(payload?.title)} ${text(payload?.objective)} ${text(payload?.intent)} ${text(payload?.prompt)} ${text(metadata.knowledgeSlug)}`.toLowerCase();
    return inParcel.find((seed) => [seed.id, seed.title, seed.knowledgeSlug].some((value) => value && haystack.includes(String(value).toLowerCase())))
      || seeds.find((seed) => [seed.id, seed.title, seed.knowledgeSlug].some((value) => value && haystack.includes(String(value).toLowerCase())))
      || null;
  }

  function draftFor(payload, operationId) {
    const seed = missionSeed(payload);
    if (!seed) throw new Error("Aucune graine correspondant à la parcelle choisie.");
    try { global.GardenStore?.activateSeed?.(seed.parcelId, seed.id); } catch (_) {}
    const draft = global.AdventureDraft?.create?.({
      id: `adventure_${operationId}`,
      status: "validated",
      curiosity: { id: seed.id, title: seed.title || seed.id },
      objective: text(payload?.objective || payload?.intent) || text(seed.objective || seed.content),
      bag: Array.isArray(payload?.requiredCapabilities) ? payload.requiredCapabilities.map(String) : [],
      picnic: ["Publisher", text(payload?.context?.metadata?.knowledgeSlug)].filter(Boolean),
      grafts: [],
      limits: ["Aucune action externe sans validation humaine"],
      note: `Mission créée depuis Cultiver pour la parcelle ${seed.parcelId}.`,
      gardenerValidation: { validatedAt: new Date().toISOString(), note: "Validation explicite par le bouton Cultiver." }
    });
    if (!draft) throw new Error("Impossible de créer la mission de culture.");
    return global.AdventureDraft?.save?.(draft) || draft;
  }

  async function queue(payload) {
    const operationId = text(payload?.operationId) || `poulpe_${Date.now()}`;
    const seed = missionSeed(payload);
    const pending = read(PENDING_KEY, {});
    pending[operationId] = {
      operationId,
      parcelId: text(payload?.parcelId) || text(payload?.context?.id),
      seedId: text(seed?.id),
      title: text(payload?.title),
      queuedAt: new Date().toISOString(),
      status: "cultivating-locally"
    };
    write(PENDING_KEY, pending);

    try {
      const draft = draftFor(payload, operationId);
      if (!global.GerardLocalHarvester?.harvest) throw new Error("Le moteur de récolte locale n’est pas prêt.");

      try {
        global.GardenStore?.upsertOperation?.({
          id: operationId,
          parcelId: pending[operationId].parcelId || "poulpe-fiction",
          seedId: pending[operationId].seedId || draft.curiosity.id,
          intent: text(payload?.objective || payload?.intent) || "mission",
          activity: `Gérard cultive ${draft.curiosity.title || draft.curiosity.id}`,
          status: "running",
          updatedAt: new Date().toISOString()
        });
      } catch (_) {}

      const bundle = await global.GerardLocalHarvester.harvest(draft, "cultiver");
      const parcelId = pending[operationId].parcelId;
      delete pending[operationId];
      write(PENDING_KEY, pending);
      return {
        result: {
          status: "completed",
          operationId: bundle?.operationId || operationId,
          parcelId,
          contextId: parcelId,
          summary: `Récolte produite pour ${draft.curiosity.title || draft.curiosity.id}.`,
          source: "gerard-local-harvester"
        },
        bundle,
        context: payload?.context || {}
      };
    } catch (error) {
      pending[operationId] = { ...pending[operationId], status: "blocked", error: error instanceof Error ? error.message : String(error) };
      write(PENDING_KEY, pending);
      throw error;
    }
  }

  function artifactFrom(entry) {
    const result = record(entry?.result);
    const output = record(result.output);
    const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
    const artifact = artifacts.find((item) => text(item.content) || text(item.artifact) || text(item.url) || text(item.downloadUrl)) || {};
    return {
      content: text(artifact.content) || text(artifact.artifact) || text(output.text) || text(entry?.content) || text(result.content),
      url: text(artifact.url) || text(artifact.downloadUrl) || text(result.url),
      title: text(artifact.title) || text(entry?.title) || "Récolte Publisher",
      mimeType: text(artifact.mimeType) || "text/markdown; charset=utf-8"
    };
  }

  function ingest(entry) {
    const operationId = text(entry?.operationId);
    if (!operationId || entry?.status !== "completed") return false;
    const processed = read(PROCESSED_KEY, {});
    if (processed[operationId]) return false;
    const artifact = artifactFrom(entry);
    if (!artifact.content && !artifact.url) return false;
    const parcelId = text(entry.parcelId) || "poulpe-fiction";
    const seedId = text(entry.seedId) || null;
    try {
      global.GardenStore?.addHarvest?.({
        id: `publisher_${operationId}`,
        operationId,
        parcelId,
        seedId,
        title: artifact.title,
        preview: artifact.content.slice(0, 280),
        content: artifact.content,
        originalContent: artifact.content,
        latestContent: artifact.content,
        url: artifact.url,
        type: artifact.mimeType,
        payload: entry,
        status: "ready",
        createdAt: text(entry.completedAt) || new Date().toISOString()
      });
      if (seedId) global.GardenStore?.updateSeed?.(seedId, { status: "harvested", lastOperationId: operationId, lastHarvestAt: text(entry.completedAt) || new Date().toISOString() });
    } catch (_) { return false; }
    processed[operationId] = { processedAt: new Date().toISOString(), completedAt: entry.completedAt || null };
    write(PROCESSED_KEY, processed);
    return true;
  }

  async function sync() {
    try {
      const response = await fetch(`${FEED_URL}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (response.status === 404) return { connected: true, imported: 0, total: 0, waitingForFirstHarvest: true };
      if (!response.ok) return { connected: false, status: response.status, imported: 0 };
      const feed = await response.json();
      const harvests = Array.isArray(feed?.harvests) ? feed.harvests : [];
      const imported = harvests.reduce((count, entry) => count + (ingest(entry) ? 1 : 0), 0);
      return { connected: true, generatedAt: feed.generatedAt || null, imported, total: harvests.length };
    } catch (error) {
      return { connected: false, imported: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  global.PoulpeGitHubRuntime = { version: 7, queue, sync, compactMission, feedUrl: FEED_URL, pending: () => read(PENDING_KEY, {}) };
  global.setTimeout(() => void sync(), 1500);
  global.setInterval(() => void sync(), POLL_MS);
  global.addEventListener?.("focus", () => void sync());
})(globalThis);