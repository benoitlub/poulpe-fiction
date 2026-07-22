(function runtimeConfigModule(global) {
  "use strict";

  const environment = "github-only";
  const urls = {
    octopusApi: "",
    publisherApi: "",
    publisherFrontend: "https://github.com/benoitlub/blacklace-publisher-ai",
    githubRuntime: "https://github.com/benoitlub/poulpe-fiction/issues/new",
    gardenFeed: ""
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
    localStorage.setItem("poulpe-fiction:runtime-config-migration:v4", JSON.stringify({ version: 4, migratedAt: new Date().toISOString(), removedKeys: previous.map((entry) => entry.key), runtime: "github-only", octopusUntouched: true }));
    return previous;
  }

  function withTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(() => clearTimeout(timer));
  }

  async function testConnections() {
    return {
      checkedAt: new Date().toISOString(),
      environment,
      urls,
      github: { connected: true, status: "Poulpe Fiction GitHub Issues" },
      octopus: { connected: false, status: "Non modifié et non requis pour l'interface de secours" },
      publisherApi: { connected: false, status: "Aucune API permanente configurée" },
      mistral: { connected: false, status: "Aucun workflow autonome actif" }
    };
  }

  migrateLocalStorageOverrides();
  global.PoulpeRuntimeConfig = { environment, urls, buildSha, staleOverrideKeys: STALE_OVERRIDE_KEYS, migrateLocalStorageOverrides, withTimeout, testConnections };
  global.OCTOPUS_API = "";
  global.PUBLISHER_API = "";
  global.PUBLISHER_FRONTEND = urls.publisherFrontend;
})(globalThis);
