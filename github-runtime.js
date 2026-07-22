(function publisherRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:publisher-pending:v1";
  const PROCESSED_KEY = "poulpe-fiction:publisher-processed:v1";
  const API_KEY = "poulpe-fiction:publisher-api-url";

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const cut = (value, limit) => text(value).slice(0, limit);

  function apiBase() {
    const fromGlobal = text(global.PUBLISHER_API_URL);
    const fromStorage = text(localStorage.getItem(API_KEY));
    const fromMeta = text(document.querySelector('meta[name="publisher-api-url"]')?.content);
    return (fromGlobal || fromStorage || fromMeta).replace(/\/+$/, "");
  }

  function setApiUrl(url) {
    const normalized = text(url).replace(/\/+$/, "");
    if (normalized) localStorage.setItem(API_KEY, normalized);
    else localStorage.removeItem(API_KEY);
    return normalized;
  }

  function compactMission(payload) {
    const context = record(payload?.context);
    const metadata = record(context.metadata);
    return {
      operationId: text(payload?.operationId) || `poulpe_${Date.now()}`,
      title: cut(payload?.title, 180) || "Mission Gérard",
      objective: cut(payload?.objective || payload?.intent, 1800),
      requiredCapabilities: Array.isArray(payload?.requiredCapabilities) ? payload.requiredCapabilities.slice(0, 12).map(String) : [],
      authorizedResources: Array.isArray(payload?.authorizedResources) ? payload.authorizedResources.slice(0, 12).map(String) : ["publisher"],
      parcelId: text(payload?.parcelId) || text(context.id) || "poulpe-fiction",
      seedId: text(payload?.seedId) || text(metadata.seedId),
      context: {
        id: text(context.id) || text(payload?.parcelId) || "poulpe-fiction",
        label: cut(context.label, 120),
        metadata: {
          ...metadata,
          parcelId: text(metadata.parcelId) || text(payload?.parcelId) || text(context.id),
          seedId: text(metadata.seedId) || text(payload?.seedId),
          trigger: "poulpe-fiction-direct-publisher"
        }
      },
      prompt: cut(payload?.prompt, 4000)
    };
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
    global.GardenStore?.upsertOperation?.({ id: operationId, parcelId, seedId: seedId || "poulpe-fiction", intent: text(entry.title) || "publisher-harvest", activity: "Récolte reçue de Blacklace Publisher", status: "ready", updatedAt: new Date().toISOString() });

    processed[operationId] = { processedAt: new Date().toISOString(), completedAt: entry.completedAt || null };
    write(PROCESSED_KEY, processed);
    const pending = read(PENDING_KEY, {});
    delete pending[operationId];
    write(PENDING_KEY, pending);
    return true;
  }

  async function queue(payload) {
    const endpoint = apiBase();
    if (!endpoint) {
      throw new Error("Publisher n’est pas configuré : renseigne son URL d’API dans le Local technique.");
    }

    const mission = compactMission(payload);
    const pending = read(PENDING_KEY, {});
    pending[mission.operationId] = {
      operationId: mission.operationId,
      parcelId: mission.parcelId,
      seedId: mission.seedId,
      title: mission.title,
      queuedAt: new Date().toISOString(),
      status: "waiting-publisher"
    };
    write(PENDING_KEY, pending);

    global.GardenStore?.upsertOperation?.({
      id: mission.operationId,
      parcelId: mission.parcelId,
      seedId: mission.seedId || "poulpe-fiction",
      intent: mission.objective || mission.prompt || "mission",
      activity: `Publisher prépare ${mission.title}`,
      status: "running",
      updatedAt: new Date().toISOString()
    });

    try {
      const response = await fetch(`${endpoint}/api/poulpe/harvest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(mission)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(text(body?.error) || `Publisher a répondu ${response.status}.`);
      if (!ingest(body)) throw new Error("Publisher a répondu sans récolte exploitable.");
      return { result: body, bundle: body, context: mission.context };
    } catch (error) {
      pending[mission.operationId] = { ...pending[mission.operationId], status: "blocked", error: error instanceof Error ? error.message : String(error) };
      write(PENDING_KEY, pending);
      global.GardenStore?.upsertOperation?.({
        id: mission.operationId,
        parcelId: mission.parcelId,
        seedId: mission.seedId || "poulpe-fiction",
        intent: mission.objective || mission.prompt || "mission",
        activity: "Publisher indisponible",
        status: "blocked",
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  async function sync() {
    const endpoint = apiBase();
    if (!endpoint) return { connected: false, configured: false };
    try {
      const response = await fetch(`${endpoint}/health`, { cache: "no-store", headers: { Accept: "application/json" } });
      return { connected: response.ok, configured: true, status: response.status };
    } catch (error) {
      return { connected: false, configured: true, error: error instanceof Error ? error.message : String(error) };
    }
  }

  global.PoulpeGitHubRuntime = {
    version: 8,
    queue,
    sync,
    compactMission,
    apiBase,
    setApiUrl,
    pending: () => read(PENDING_KEY, {})
  };
})(globalThis);
