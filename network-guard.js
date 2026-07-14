(function networkGuardModule(global) {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 6000;
  const nativeFetch = global.fetch?.bind(global);
  if (!nativeFetch || global.__poulpeFetchGuardInstalled) return;

  function timeoutError() {
    return new Error("Le service distant met trop de temps à répondre. Gérard continue en mode local.");
  }

  function withTimeout(promise, controller, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = global.setTimeout(() => {
        try { controller?.abort(); } catch (_) {}
        reject(timeoutError());
      }, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => global.clearTimeout(timer));
  }

  function wrapResponse(response, controller) {
    const originalJson = response.json?.bind(response);
    const originalText = response.text?.bind(response);
    const originalBlob = response.blob?.bind(response);
    const originalArrayBuffer = response.arrayBuffer?.bind(response);

    if (originalJson) response.json = () => withTimeout(originalJson(), controller);
    if (originalText) response.text = () => withTimeout(originalText(), controller);
    if (originalBlob) response.blob = () => withTimeout(originalBlob(), controller);
    if (originalArrayBuffer) response.arrayBuffer = () => withTimeout(originalArrayBuffer(), controller);
    return response;
  }

  async function guardedFetch(input, init = {}) {
    if (init.signal) return nativeFetch(input, init);

    const controller = new AbortController();
    try {
      const response = await withTimeout(
        nativeFetch(input, { ...init, signal: controller.signal }),
        controller
      );
      return wrapResponse(response, controller);
    } catch (error) {
      if (error?.name === "AbortError" || /trop de temps/i.test(error?.message || "")) {
        throw timeoutError();
      }
      throw error;
    }
  }

  global.fetch = guardedFetch;
  global.__poulpeFetchGuardInstalled = true;
  global.PoulpeNetworkGuard = { timeoutMs: DEFAULT_TIMEOUT_MS, guardsResponseBody: true };
})(globalThis);
