(function productionStatusSyncModule(global) {
  "use strict";

  const planApi = global.ProductionPlan;
  const packApi = global.ProductionPack;
  if (!planApi || !packApi) return;

  const originalCurrent = planApi.current.bind(planApi);
  const originalUpdate = planApi.updateFromProductionPack.bind(planApi);
  let reconciling = false;

  function latestPackForSeed(seedId) {
    return (packApi.load?.() || []).find((pack) => pack.seedId === seedId) || null;
  }

  function reconcile(pack) {
    if (!pack || reconciling) return null;
    reconciling = true;
    try {
      return originalUpdate(pack);
    } finally {
      reconciling = false;
    }
  }

  planApi.current = function currentWithPackReconciliation() {
    const plan = originalCurrent();
    if (!plan || reconciling) return plan;
    const pack = latestPackForSeed(plan.seedId);
    return pack ? reconcile(pack) || plan : plan;
  };

  planApi.updateFromProductionPack = function updateAndPersist(pack) {
    return reconcile(pack);
  };

  const active = originalCurrent();
  const existingPack = active ? latestPackForSeed(active.seedId) : null;
  if (existingPack) reconcile(existingPack);
})(globalThis);
