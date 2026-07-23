(function publisherRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:publisher-pending:v1";
  const PROCESSED_KEY = "poulpe-fiction:publisher-processed:v1";
  const HARVEST_FEED = "https://raw.githubusercontent.com/benoitlub/blacklace-publisher-ai/main/public/harvests/latest.json";
  const ACTIONS_URL = "https://github.com/benoitlub/blacklace-publisher-ai/actions/workflows/publisher-harvest.yml";

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
          trigger: "poulpe-fiction-github-actions"
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
    for (const id of Object.keys(pending)) {
      if (pending[id]?.parcelId === parcelId) delete pending[id];
    }
    write(PENDING_KEY, pending);
    return true;
  }

  async function queue(payload) {
    const mission = compactMission(payload);
    const pending = read(PENDING_KEY, {});
    pending[mission.operationId] = {
      operationId: mission.operationId,
      parcelId: mission.parcelId,
      seedId: mission.seedId,
      title: mission.title,
      objective: mission.objective,
      context: mission.prompt || "",
      queuedAt: new Date().toISOString(),
      status: "waiting-github-action",
      actionsUrl: ACTIONS_URL
    };
    write(PENDING_KEY, pending);

    global.GardenStore?.upsertOperation?.({
      id: mission.operationId,
      parcelId: mission.parcelId,
      seedId: mission.seedId || "poulpe-fiction",
      intent: mission.objective || mission.prompt || "mission",
      activity: "Mission prête pour Publisher sur GitHub",
      status: "waiting-approval",
      updatedAt: new Date().toISOString()
    });

    global.open?.(ACTIONS_URL, "_blank", "noopener,noreferrer");
    return {
      result: {
        operationId: mission.operationId,
        parcelId: mission.parcelId,
        seedId: mission.seedId || null,
        title: mission.title,
        status: "waiting-approval",
        source: "github-actions",
        actionsUrl: ACTIONS_URL,
        message: "Lance le workflow Publisher Harvest. Poulpe récupérera automatiquement la récolte publiée."
      },
      bundle: mission,
      context: mission.context
    };
  }

  async function sync() {
    try {
      const response = await fetch(`${HARVEST_FEED}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (response.status === 404) return { connected: true, configured: true, harvested: false, empty: true, source: "github-actions" };
      if (!response.ok) return { connected: false, configured: true, status: response.status, source: "github-actions" };
      const entry = await response.json();
      return { connected: true, configured: true, harvested: ingest(entry), entry, source: "github-actions" };
    } catch (error) {
      return { connected: false, configured: true, source: "github-actions", error: error instanceof Error ? error.message : String(error) };
    }
  }

  global.PoulpeGitHubRuntime = {
    version: 9,
    queue,
    sync,
    compactMission,
    apiBase: () => HARVEST_FEED,
    setApiUrl: () => HARVEST_FEED,
    actionsUrl: ACTIONS_URL,
    pending: () => read(PENDING_KEY, {})
  };
})(globalThis);
