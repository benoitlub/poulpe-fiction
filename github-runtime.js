(function githubRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:github-pending:v4";
  const PROCESSED_KEY = "poulpe-fiction:github-processed:v4";
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

  async function queue(payload) {
    const operationId = text(payload?.operationId) || `poulpe_${Date.now()}`;
    const pending = read(PENDING_KEY, {});
    pending[operationId] = {
      operationId,
      parcelId: text(payload?.parcelId) || text(payload?.context?.id),
      seedId: text(payload?.seedId) || text(payload?.context?.metadata?.seedId),
      title: text(payload?.title),
      queuedAt: new Date().toISOString(),
      status: "cultivating-locally"
    };
    write(PENDING_KEY, pending);

    try {
      const draft = global.AdventureDraft?.load?.();
      if (!draft) throw new Error("Aucune mission active à cultiver.");
      if (!global.GerardLocalHarvester?.harvest) throw new Error("Le moteur de récolte locale n’est pas prêt.");

      try {
        global.GardenStore?.upsertOperation?.({
          id: operationId,
          parcelId: pending[operationId].parcelId || "poulpe-fiction",
          seedId: pending[operationId].seedId || "poulpe-fiction",
          intent: text(payload?.objective || payload?.intent) || "mission",
          activity: "Gérard cultive la mission",
          status: "running",
          updatedAt: new Date().toISOString()
        });
      } catch (_) {}

      const bundle = await global.GerardLocalHarvester.harvest(draft, "cultiver");
      delete pending[operationId];
      write(PENDING_KEY, pending);
      return {
        result: {
          status: "completed",
          operationId: bundle?.operationId || operationId,
          parcelId: pending[operationId]?.parcelId || text(payload?.parcelId) || text(payload?.context?.id),
          contextId: text(payload?.parcelId) || text(payload?.context?.id),
          summary: "Récolte produite et déposée dans le Garden.",
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

  global.PoulpeGitHubRuntime = { version: 6, queue, sync, compactMission, feedUrl: FEED_URL, pending: () => read(PENDING_KEY, {}) };
  global.setTimeout(() => void sync(), 1500);
  global.setInterval(() => void sync(), POLL_MS);
  global.addEventListener?.("focus", () => void sync());
})(globalThis);