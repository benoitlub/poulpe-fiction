(function runtimeConfigModule(global) {
  "use strict";

  const environment = "github-only";
  const urls = {
    octopusApi: "",
    publisherApi: "",
    publisherFrontend: "https://github.com/benoitlub/blacklace-publisher-ai",
    githubRuntime: "https://github.com/benoitlub/octopus-engine/actions/workflows/publisher-autonomous-curation.yml",
    gardenFeed: "https://raw.githubusercontent.com/benoitlub/octopus-engine/main/garden-feed/latest.json"
  };
  const buildSha = String(global.POULPE_BUILD_SHA || "github").slice(0, 7);
  const STALE_OVERRIDE_KEYS = ["PUBLISHER_API_URL", "OCTOPUS_API_URL", "API_URL", "PUBLISHER_FRONTEND_URL", "poulpe-fiction:garden-api-url:v1"];

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
    localStorage.setItem("poulpe-fiction:runtime-config-migration:v3", JSON.stringify({ version: 3, migratedAt: new Date().toISOString(), removedKeys: previous.map((entry) => entry.key), runtime: "github-only" }));
    return previous;
  }

  function withTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(() => clearTimeout(timer));
  }

  async function testConnections(timeoutMs = 8000) {
    try {
      const response = await withTimeout(`${urls.gardenFeed}?t=${Date.now()}`, { headers: { Accept: "application/json" }, cache: "no-store" }, timeoutMs);
      const payload = response.ok ? await response.json() : null;
      return {
        checkedAt: new Date().toISOString(),
        environment,
        urls,
        github: { connected: response.ok, status: response.status, feed: payload },
        octopus: { connected: response.ok, status: "GitHub Actions" },
        publisherApi: { connected: response.ok, status: "GitHub Actions" },
        mistral: { connected: response.ok, status: "Secret injecté uniquement dans GitHub Actions", provider: "mistral", model: "mistral-small-latest" }
      };
    } catch (error) {
      return { checkedAt: new Date().toISOString(), environment, urls, github: { connected: false, error: error instanceof Error ? error.message : String(error) }, octopus: { connected: false }, publisherApi: { connected: false }, mistral: { connected: false } };
    }
  }

  migrateLocalStorageOverrides();
  global.PoulpeRuntimeConfig = { environment, urls, buildSha, staleOverrideKeys: STALE_OVERRIDE_KEYS, migrateLocalStorageOverrides, withTimeout, testConnections };
  global.OCTOPUS_API = "";
  global.PUBLISHER_API = "";
  global.PUBLISHER_FRONTEND = urls.publisherFrontend;
})(globalThis);
