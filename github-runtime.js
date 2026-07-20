(function githubRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:github-pending:v1";
  const PROCESSED_KEY = "poulpe-fiction:github-processed:v1";
  const ISSUE_BASE = "https://github.com/benoitlub/octopus-engine/issues/new";
  const FEED_URL = "https://raw.githubusercontent.com/benoitlub/octopus-engine/main/garden-feed/latest.json";
  const POLL_MS = 60 * 1000;

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };

  function issueUrl(payload) {
    const title = `[POULPE] ${text(payload.title) || text(payload.operationId) || "Mission Gérard"}`;
    return `${ISSUE_BASE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
  }

  function queue(payload, options = {}) {
    const operationId = text(payload?.operationId) || `poulpe_${Date.now()}`;
    const normalized = { ...payload, operationId };
    const pending = read(PENDING_KEY, {});
    pending[operationId] = {
      operationId,
      parcelId: text(payload?.parcelId) || text(payload?.context?.id),
      seedId: text(payload?.seedId) || text(payload?.context?.metadata?.seedId),
      title: text(payload?.title),
      queuedAt: new Date().toISOString(),
      status: "waiting-github-submit"
    };
    write(PENDING_KEY, pending);
    const url = issueUrl(normalized);
    if (options.open !== false) global.open(url, "_blank", "noopener,noreferrer");
    try { global.pushChat?.("gerard", "🐙 La mission est prête dans GitHub. Valide l’ouverture de l’issue : je la traiterai avec Octopus, Publisher et Mistral."); } catch (_) {}
    return {
      result: {
        status: "queued",
        operationId,
        parcelId: pending[operationId].parcelId,
        contextId: pending[operationId].parcelId,
        summary: "Mission préparée pour le runtime GitHub. Une issue préremplie a été ouverte pour validation.",
        source: "github-issue",
        issueUrl: url
      },
      bundle: null,
      context: payload?.context || {}
    };
  }

  function artifactFrom(entry) {
    const result = record(entry?.result);
    const output = record(result.output);
    const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
    const artifact = artifacts.find((item) => text(item.content) || text(item.artifact) || text(item.url) || text(item.downloadUrl)) || {};
    return {
      content: text(artifact.content) || text(artifact.artifact) || text(output.text) || text(result.content),
      url: text(artifact.url) || text(artifact.downloadUrl) || text(result.url),
      title: text(artifact.title) || text(entry.title) || "Récolte GitHub/Mistral",
      mimeType: text(artifact.mimeType) || "text/markdown; charset=utf-8"
    };
  }

  function ingest(entry) {
    const operationId = text(entry?.operationId);
    if (!operationId || entry?.status !== "completed" || !entry?.result) return false;
    const processed = read(PROCESSED_KEY, {});
    if (processed[operationId]) return false;
    const artifact = artifactFrom(entry);
    if (!artifact.content && !artifact.url) return false;
    const parcelId = text(entry.parcelId) || "poulpe-fiction";
    const seedId = text(entry.seedId) || null;
    try {
      global.GardenStore?.addHarvest?.({
        id: `github_${operationId}`,
        operationId,
        parcelId,
        seedId,
        title: artifact.title,
        preview: artifact.content.slice(0, 280),
        content: artifact.content,
        url: artifact.url,
        type: artifact.mimeType,
        payload: entry,
        status: "ready",
        createdAt: text(entry.completedAt) || new Date().toISOString()
      });
      if (seedId) global.GardenStore?.updateSeed?.(seedId, { status: "harvested", lastOperationId: operationId, lastHarvestAt: text(entry.completedAt) || new Date().toISOString() });
      global.GardenStore?.upsertOperation?.({ id: operationId, parcelId, seedId: seedId || "poulpe-fiction", intent: text(entry.title) || "github-runtime", activity: "Récolte reçue de GitHub/Mistral", status: "ready", updatedAt: new Date().toISOString() });
    } catch (_) { return false; }
    processed[operationId] = { processedAt: new Date().toISOString(), feedGeneratedAt: entry.completedAt || null };
    write(PROCESSED_KEY, processed);
    const pending = read(PENDING_KEY, {});
    delete pending[operationId];
    write(PENDING_KEY, pending);
    try { global.pushChat?.("gerard", `🌾 La récolte « ${artifact.title} » est revenue de GitHub/Mistral et se trouve dans le Garden.`); } catch (_) {}
    global.dispatchEvent?.(new CustomEvent("poulpe-github-harvest", { detail: entry }));
    return true;
  }

  async function sync() {
    try {
      const response = await fetch(`${FEED_URL}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) return { connected: false, status: response.status, imported: 0 };
      const feed = await response.json();
      const harvests = Array.isArray(feed?.harvests) ? feed.harvests : [];
      const imported = harvests.reduce((count, entry) => count + (ingest(entry) ? 1 : 0), 0);
      return { connected: true, generatedAt: feed.generatedAt || null, imported, total: harvests.length };
    } catch (error) {
      return { connected: false, imported: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  global.PoulpeGitHubRuntime = { version: 1, queue, sync, issueUrl, feedUrl: FEED_URL, pending: () => read(PENDING_KEY, {}) };
  global.setTimeout(() => void sync(), 1500);
  global.setInterval(() => void sync(), POLL_MS);
  global.addEventListener?.("focus", () => void sync());
})(globalThis);
