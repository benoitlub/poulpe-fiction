(function publisherClientModule(global) {
  "use strict";

  // Single place that knows how to reach Publisher's production engine.
  // Before this module, five different files each carried their own copy of
  // this exact ternary (blacklace-parcel.js, production-pack.js,
  // terra-harvest-loop.js, gerard-local-harvester.js, poulpe-octopus-adapter.js)
  // and gerard-local-harvester.js additionally duplicated the whole
  // fetch/timeout/error-shape dance twice (once for Mistral, once for
  // Canva). Everything now goes through base()/execute() here instead.
  function base() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
    catch (_) { return ""; }
  }

  // Calls Publisher's single production endpoint. Returns the parsed
  // { status: "completed", artifact, ... } payload, or null on any failure
  // (unconfigured, timeout, non-completed status) — callers already have a
  // template/local fallback for that case, so this never throws.
  async function execute(tool, action, input, options = {}) {
    const publisherBase = base();
    if (!publisherBase) return null;
    try {
      const request = global.PoulpeRuntimeConfig?.withTimeout || fetch;
      const response = await request(`${publisherBase}/api/production/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, action, input }),
      }, options.timeoutMs || 15000);
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      if (payload?.status !== "completed") return null;
      return payload;
    } catch (_) {
      return null;
    }
  }

  // Pushes the local Seed catalog to Publisher's Neon-backed tentacle table
  // so the server-side relentless-improvement loop (Cron Trigger on the
  // Worker) knows what to work on even once the browser tab closes. Silent,
  // non-blocking, fire-and-forget — never surfaces an error to the user.
  async function syncTentacles(seeds) {
    const publisherBase = base();
    if (!publisherBase || !Array.isArray(seeds) || !seeds.length) return false;
    try {
      const request = global.PoulpeRuntimeConfig?.withTimeout || fetch;
      const response = await request(`${publisherBase}/api/tentacles/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds }),
      }, 10000);
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  // Generic GET, for read-only endpoints (e.g. /api/tentacles/iterations)
  // that don't fit execute()'s POST-a-tool-call shape.
  async function get(path, options = {}) {
    const publisherBase = base();
    if (!publisherBase) return null;
    try {
      const request = global.PoulpeRuntimeConfig?.withTimeout || fetch;
      const response = await request(`${publisherBase}${path}`, {}, options.timeoutMs || 10000);
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch (_) {
      return null;
    }
  }

  global.PublisherClient = { base, execute, syncTentacles, get };
})(globalThis);
