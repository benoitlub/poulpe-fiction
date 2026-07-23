(function runtimeConfigModule(global) {
  "use strict";

  const environment = "publisher-direct";
  const PUBLISHER_API_KEY = "poulpe-fiction:publisher-api-url";

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const normalizeUrl = (value) => text(value).replace(/\/+$/, "");
  const storedPublisherApi = typeof localStorage !== "undefined"
    ? normalizeUrl(localStorage.getItem(PUBLISHER_API_KEY))
    : "";

  const urls = {
    octopusApi: "",
    publisherApi: normalizeUrl(global.PUBLISHER_API_URL) || storedPublisherApi,
    publisherFrontend: "https://github.com/benoitlub/blacklace-publisher-ai",
    githubRuntime: "",
    gardenFeed: ""
  };

  const buildSha = String(global.POULPE_BUILD_SHA || "github").slice(0, 7);
  const STALE_OVERRIDE_KEYS = ["OCTOPUS_API_URL", "API_URL", "PUBLISHER_FRONTEND_URL", "poulpe-fiction:garden-api-url:v1"];

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
    localStorage.setItem("poulpe-fiction:runtime-config-migration:v5", JSON.stringify({
      version: 5,
      migratedAt: new Date().toISOString(),
      removedKeys: previous.map((entry) => entry.key),
      runtime: environment,
      publisherApiPreserved: true,
      octopusUntouched: true
    }));
    return previous;
  }

  function withTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(() => clearTimeout(timer));
  }

  async function testConnections() {
    const publisherApi = normalizeUrl(global.PUBLISHER_API_URL) || normalizeUrl(localStorage.getItem(PUBLISHER_API_KEY));
    if (!publisherApi) {
      return {
        checkedAt: new Date().toISOString(),
        environment,
        urls: { ...urls, publisherApi: "" },
        github: { connected: true, status: "Interface hébergée sur GitHub Pages" },
        octopus: { connected: false, status: "Non requis pour la liaison Poulpe → Publisher" },
        publisherApi: { connected: false, configured: false, status: "URL Publisher à renseigner dans le Local technique" },
        mistral: { connected: false, status: "Vérifiable après connexion à Publisher" }
      };
    }

    try {
      const response = await withTimeout(`${publisherApi}/health`, { cache: "no-store", headers: { Accept: "application/json" } });
      return {
        checkedAt: new Date().toISOString(),
        environment,
        urls: { ...urls, publisherApi },
        github: { connected: true, status: "Interface hébergée sur GitHub Pages" },
        octopus: { connected: false, status: "Non requis pour la liaison Poulpe → Publisher" },
        publisherApi: { connected: response.ok, configured: true, status: response.status },
        mistral: { connected: response.ok, status: response.ok ? "Disponible via Publisher" : "Publisher ne répond pas correctement" }
      };
    } catch (error) {
      return {
        checkedAt: new Date().toISOString(),
        environment,
        urls: { ...urls, publisherApi },
        github: { connected: true, status: "Interface hébergée sur GitHub Pages" },
        octopus: { connected: false, status: "Non requis pour la liaison Poulpe → Publisher" },
        publisherApi: { connected: false, configured: true, status: error instanceof Error ? error.message : String(error) },
        mistral: { connected: false, status: "Publisher inaccessible" }
      };
    }
  }

  migrateLocalStorageOverrides();
  global.PoulpeRuntimeConfig = { environment, urls, buildSha, staleOverrideKeys: STALE_OVERRIDE_KEYS, migrateLocalStorageOverrides, withTimeout, testConnections };
  global.OCTOPUS_API = "";
  global.PUBLISHER_API_URL = urls.publisherApi;
  global.PUBLISHER_API = urls.publisherApi;
  global.PUBLISHER_FRONTEND = urls.publisherFrontend;
})(globalThis);
