(function runtimeConfigModule(global) {
  "use strict";

  const environment = "production";
  const urls = {
    octopusApi: "https://octopus-engine.onrender.com",
    publisherApi: "https://blacklace-publisher-api.onrender.com",
    publisherFrontend: "https://blacklace-publisher-web.onrender.com"
  };
  const buildSha = String(global.POULPE_BUILD_SHA || global.RENDER_GIT_COMMIT || "local").slice(0, 7);
  const MIGRATION_KEY = "poulpe-fiction:runtime-config-migration:v2";
  const STALE_OVERRIDE_KEYS = [
    "PUBLISHER_API_URL",
    "OCTOPUS_API_URL",
    "API_URL",
    "PUBLISHER_FRONTEND_URL",
    "poulpe-fiction:garden-api-url:v1"
  ];
  const LOCAL_HOST_RE = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(?::|\/|$)/i;

  function stripTrailingSlash(value) {
    return String(value || "").trim().replace(/\/$/, "");
  }

  function sanitizeServiceUrl(candidate, officialUrl, currentEnvironment = environment) {
    const official = stripTrailingSlash(officialUrl);
    const value = stripTrailingSlash(candidate);
    if (!value) return official;
    if (currentEnvironment !== "production") {
      try {
        return new URL(value).toString().replace(/\/$/, "");
      } catch (_) {
        return official;
      }
    }
    if (LOCAL_HOST_RE.test(value)) return official;
    try {
      const parsed = new URL(value).toString().replace(/\/$/, "");
      return parsed === official ? parsed : official;
    } catch (_) {
      return official;
    }
  }

  function migrateLocalStorageOverrides() {
    if (typeof localStorage === "undefined") return [];
    const previous = [];
    STALE_OVERRIDE_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        previous.push({ key, value });
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem(MIGRATION_KEY, JSON.stringify({
      version: 2,
      migratedAt: new Date().toISOString(),
      removedKeys: previous.map((entry) => entry.key)
    }));
    return previous;
  }

  function withTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .finally(() => clearTimeout(timer));
  }

  async function checkJson(url, timeoutMs) {
    try {
      const response = await withTimeout(url, { headers: { Accept: "application/json" } }, timeoutMs);
      let payload = null;
      try { payload = await response.json(); } catch (_) {}
      return { connected: response.ok, status: response.status, url, payload, error: response.ok ? null : `HTTP ${response.status}` };
    } catch (error) {
      return { connected: false, status: null, url, payload: null, error: error instanceof Error ? error.message : "Request failed" };
    }
  }

  async function checkReachable(url, timeoutMs) {
    try {
      const response = await withTimeout(url, { mode: "no-cors" }, timeoutMs);
      return { connected: true, status: response.status || "opaque", url, error: null };
    } catch (error) {
      return { connected: false, status: null, url, error: error instanceof Error ? error.message : "Request failed" };
    }
  }

  async function testConnections(timeoutMs = 8000) {
    const octopusHealthUrl = `${urls.octopusApi}/health`;
    const publisherDiagnosticsUrl = `${urls.publisherApi}/api/production/diagnostics`;
    const publisherLocalTechniqueUrl = `${urls.publisherFrontend}/local-technique`;
    const [octopus, publisherApi, publisherFrontend] = await Promise.all([
      checkJson(octopusHealthUrl, timeoutMs),
      checkJson(publisherDiagnosticsUrl, timeoutMs),
      checkReachable(publisherLocalTechniqueUrl, timeoutMs)
    ]);
    const canvaConnected = Boolean(
      publisherApi.payload?.canva?.connected ||
      publisherApi.payload?.composio?.canvaConnected
    );
    return {
      checkedAt: new Date().toISOString(),
      environment,
      urls,
      octopus,
      publisherApi,
      publisherFrontend,
      canva: {
        connected: canvaConnected,
        status: canvaConnected ? "connecté via Composio" : "non connecté",
        url: publisherDiagnosticsUrl
      }
    };
  }

  migrateLocalStorageOverrides();

  global.PoulpeRuntimeConfig = {
    environment,
    urls: {
      octopusApi: sanitizeServiceUrl(urls.octopusApi, urls.octopusApi, environment),
      publisherApi: sanitizeServiceUrl(urls.publisherApi, urls.publisherApi, environment),
      publisherFrontend: sanitizeServiceUrl(urls.publisherFrontend, urls.publisherFrontend, environment)
    },
    buildSha,
    staleOverrideKeys: STALE_OVERRIDE_KEYS,
    sanitizeServiceUrl,
    migrateLocalStorageOverrides,
    testConnections
  };
  global.OCTOPUS_API = global.PoulpeRuntimeConfig.urls.octopusApi;
  global.PUBLISHER_API = global.PoulpeRuntimeConfig.urls.publisherApi;
  global.PUBLISHER_FRONTEND = global.PoulpeRuntimeConfig.urls.publisherFrontend;
})(globalThis);