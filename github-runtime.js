(function githubRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:github-pending:v1";
  const PROCESSED_KEY = "poulpe-fiction:github-processed:v1";
  const ISSUE_BASE = "https://github.com/benoitlub/octopus-engine/issues/new";
  const FEED_URL = "https://raw.githubusercontent.com/benoitlub/octopus-engine/main/garden-feed/latest.json";
  const POLL_MS = 60 * 1000;
  const MAX_ISSUE_URL = 7000;

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
          requestedProducer: text(metadata.requestedProducer),
          requestedAction: text(metadata.requestedAction),
          requestedCapability: text(metadata.requestedCapability),
          expectedHarvest: cut(metadata.expectedHarvest, 300),
          platform: text(metadata.platform),
          trigger: "poulpe-github-runtime"
        }
      },
      prompt: cut(payload?.prompt, 2600)
    };
  }

  function issueUrl(payload) {
    const compact = compactMission(payload);
    const title = `[POULPE] ${text(compact.title) || text(compact.operationId) || "Mission Gérard"}`;
    const body = JSON.stringify(compact);
    const full = `${ISSUE_BASE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    return { url: full, body, title, compact, tooLong: full.length > MAX_ISSUE_URL };
  }

  async function copyBody(body) {
    try {
      await navigator.clipboard.writeText(body);
      return true;
    } catch (_) {
      return false;
    }
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

    const issue = issueUrl(normalized);
    if (options.open !== false) {
      if (issue.tooLong) {
        void copyBody(issue.body).then((copied) => {
          const shortUrl = `${ISSUE_BASE}?title=${encodeURIComponent(issue.title)}`;
          global.open(shortUrl, "_blank", "noopener,noreferrer");
          try {
            global.pushChat?.("gerard", copied
              ? "🐙 La mission dépassait la limite GitHub. Son JSON est copié : colle-le dans le corps de l’issue puis valide."
              : "🐙 La mission dépassait la limite GitHub. Ouvre l’issue et colle le JSON de mission depuis Poulpe.");
          } catch (_) {}
        });
      } else {
        global.open(issue.url, "_blank", "noopener,noreferrer");
      }
    }

    try { global.pushChat?.("gerard", issue.tooLong ? "🐙 Mission compacte préparée pour GitHub." : "🐙 La mission est prête dans GitHub. Valide l’ouverture de l’issue : je la traiterai avec Octopus, Publisher et Mistral."); } catch (_) {}
    return {
      result: {
        status: "queued",
        operationId,
        parcelId: pending[operationId].parcelId,
        contextId: pending[operationId].parcelId,
        summary: issue.tooLong ? "Mission préparée pour GitHub avec copie de secours du JSON." : "Mission préparée pour le runtime GitHub. Une issue préremplie a été ouverte pour validation.",
        source: "github-issue",
        issueUrl: issue.tooLong ? `${ISSUE_BASE}?title=${encodeURIComponent(issue.title)}` : issue.url
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

  global.PoulpeGitHubRuntime = { version: 2, queue, sync, issueUrl, compactMission, feedUrl: FEED_URL, pending: () => read(PENDING_KEY, {}) };
  global.setTimeout(() => void sync(), 1500);
  global.setInterval(() => void sync(), POLL_MS);
  global.addEventListener?.("focus", () => void sync());
})(globalThis);