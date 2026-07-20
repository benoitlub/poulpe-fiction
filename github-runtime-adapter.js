(function githubRuntimeAdapterModule(global) {
  "use strict";
  const adapter = global.PoulpeOctopusAdapter;
  const runtime = global.PoulpeGitHubRuntime;
  if (!adapter || !runtime || adapter.__githubRuntimeInstalled) return;

  const originalDispatch = adapter.dispatch.bind(adapter);
  const hasPermanentBackend = () => Boolean(String(global.PoulpeRuntimeConfig?.urls?.octopusApi || "").trim());

  adapter.dispatch = async function githubOnlyDispatch(payload, options = {}) {
    if (!hasPermanentBackend()) {
      try {
        global.GardenStore?.upsertOperation?.({
          id: payload.operationId,
          parcelId: payload.parcelId || payload.context?.id || "poulpe-fiction",
          seedId: payload.seedId || payload.context?.metadata?.seedId || "poulpe-fiction",
          intent: payload.objective || payload.intent || "mission",
          activity: "Mission prête pour GitHub Actions",
          status: "queued",
          updatedAt: new Date().toISOString()
        });
      } catch (_) {}
      return runtime.queue(payload, options);
    }
    return originalDispatch(payload, options);
  };

  adapter.executeProduction = async function githubOnlyProduction(input) {
    const payload = adapter.productionPayload(input);
    const dispatched = await adapter.dispatch(payload, { kind: "production" });
    return { ...dispatched, payload };
  };

  adapter.__githubRuntimeInstalled = true;
})(globalThis);
