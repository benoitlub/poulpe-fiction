(function networkGuardModule(global) {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 12000;
  const nativeFetch = global.fetch?.bind(global);
  if (!nativeFetch || global.__poulpeFetchGuardInstalled) return;

  function guardedFetch(input, init = {}) {
    if (init.signal) return nativeFetch(input, init);

    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    return nativeFetch(input, { ...init, signal: controller.signal })
      .catch((error) => {
        if (error?.name === "AbortError") {
          throw new Error("Le service distant met trop de temps à répondre. Gérard continue en mode local.");
        }
        throw error;
      })
      .finally(() => global.clearTimeout(timer));
  }

  global.fetch = guardedFetch;
  global.__poulpeFetchGuardInstalled = true;
  global.PoulpeNetworkGuard = { timeoutMs: DEFAULT_TIMEOUT_MS };
})(globalThis);
