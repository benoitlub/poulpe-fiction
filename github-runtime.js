(function githubRuntimeModule(global) {
  "use strict";

  const PENDING_KEY = "poulpe-fiction:github-pending:v2";
  const ISSUE_BASE = "https://github.com/benoitlub/poulpe-fiction/issues/new";
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
          requestedCapability: text(metadata.requestedCapability),
          expectedHarvest: cut(metadata.expectedHarvest, 300),
          platform: text(metadata.platform),
          trigger: "poulpe-fiction-manual-issue"
        }
      },
      prompt: cut(payload?.prompt, 2600)
    };
  }

  function issueUrl(payload) {
    const compact = compactMission(payload);
    const title = `[POULPE] ${text(compact.title) || text(compact.operationId) || "Mission Gérard"}`;
    const body = JSON.stringify(compact, null, 2);
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
          global.open(`${ISSUE_BASE}?title=${encodeURIComponent(issue.title)}`, "_blank", "noopener,noreferrer");
          try { global.pushChat?.("gerard", copied ? "🐙 Le JSON de mission est copié. Colle-le dans l’issue Poulpe Fiction." : "🐙 Ouvre l’issue Poulpe Fiction et colle le JSON de mission."); } catch (_) {}
        });
      } else {
        global.open(issue.url, "_blank", "noopener,noreferrer");
      }
    }

    try { global.pushChat?.("gerard", "🐙 La mission est préparée dans Poulpe Fiction. Aucun workflow Octopus ou Render n’est déclenché."); } catch (_) {}
    return {
      result: {
        status: "queued",
        operationId,
        parcelId: pending[operationId].parcelId,
        contextId: pending[operationId].parcelId,
        summary: "Mission préparée dans une issue Poulpe Fiction. Aucun traitement autonome n’est revendiqué.",
        source: "github-issue",
        issueUrl: issue.tooLong ? `${ISSUE_BASE}?title=${encodeURIComponent(issue.title)}` : issue.url
      },
      bundle: null,
      context: payload?.context || {}
    };
  }

  async function sync() {
    return { connected: false, imported: 0, reason: "Aucun feed autonome configuré." };
  }

  global.PoulpeGitHubRuntime = { version: 4, queue, sync, issueUrl, compactMission, feedUrl: "", pending: () => read(PENDING_KEY, {}) };
})(globalThis);
