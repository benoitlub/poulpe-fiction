(function gardenDomainModule(global) {
  "use strict";

  const SEED_KINDS = ["intent", "idea", "opportunity", "weak-signal", "request", "book", "game", "app", "page"];
  const SEED_STATUSES = ["seed", "resonating", "sprouted", "harvested", "composted"];
  const OPERATION_STATUSES = ["idle", "queued", "running", "paused", "blocked", "ready", "failed"];

  function nowIso() {
    return new Date().toISOString();
  }

  function clampSignal(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, number));
  }

  function createSignals(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      maturity: clampSignal(source.maturity),
      coherence: clampSignal(source.coherence),
      utility: clampSignal(source.utility),
      confidence: clampSignal(source.confidence),
      estimatedCost: Math.max(0, Number(source.estimatedCost) || 0)
    };
  }

  function createSeed(input) {
    if (!input?.id) throw new Error("GardenDomain.createSeed requires an id");
    if (!input?.parcelId) throw new Error("GardenDomain.createSeed requires a parcelId");

    const timestamp = input.updatedAt || input.createdAt || nowIso();
    const kind = SEED_KINDS.includes(input.kind) ? input.kind : "idea";
    const status = SEED_STATUSES.includes(input.status) ? input.status : "seed";

    return {
      id: String(input.id),
      parcelId: String(input.parcelId),
      kind,
      title: String(input.title || input.id),
      content: String(input.content || input.objective || ""),
      objective: String(input.objective || input.content || ""),
      firstHarvest: String(input.firstHarvest || ""),
      status,
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
      signals: createSignals(input.signals),
      tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
      source: input.source ? String(input.source) : "poulpe-fiction"
    };
  }

  function createSprout(input) {
    if (!input?.id || !input?.seedId || !input?.parcelId) {
      throw new Error("GardenDomain.createSprout requires id, seedId and parcelId");
    }
    return {
      id: String(input.id),
      seedId: String(input.seedId),
      parcelId: String(input.parcelId),
      title: String(input.title || input.id),
      createdAt: input.createdAt || nowIso(),
      rationale: String(input.rationale || ""),
      proposedCapabilities: Array.isArray(input.proposedCapabilities)
        ? input.proposedCapabilities.map(String)
        : []
    };
  }

  function createHarvest(input) {
    if (!input?.id || !input?.parcelId) {
      throw new Error("GardenDomain.createHarvest requires id and parcelId");
    }
    return {
      id: String(input.id),
      parcelId: String(input.parcelId),
      seedId: input.seedId ? String(input.seedId) : null,
      operationId: input.operationId ? String(input.operationId) : null,
      productionPackId: input.productionPackId ? String(input.productionPackId) : null,
      title: String(input.title || "Récolte"),
      preview: String(input.preview || ""),
      status: String(input.status || "ready"),
      createdAt: input.createdAt || nowIso()
    };
  }

  function createOperation(input) {
    if (!input?.id || !input?.parcelId || !input?.seedId) {
      throw new Error("GardenDomain.createOperation requires id, parcelId and seedId");
    }
    const status = OPERATION_STATUSES.includes(input.status) ? input.status : "idle";
    const timestamp = input.updatedAt || input.createdAt || nowIso();
    return {
      id: String(input.id),
      parcelId: String(input.parcelId),
      seedId: String(input.seedId),
      intent: String(input.intent || "prepare-harvest"),
      status,
      activity: String(input.activity || ""),
      obstacle: input.obstacle || null,
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
      attempt: Math.max(0, Number(input.attempt) || 0)
    };
  }

  function resonanceScore(signals) {
    const value = createSignals(signals);
    const benefit = value.maturity * 0.3 + value.coherence * 0.25 + value.utility * 0.3 + value.confidence * 0.15;
    const costPenalty = Math.min(25, value.estimatedCost / 4);
    return Math.max(0, Math.min(100, Math.round(benefit - costPenalty)));
  }

  function evaluateSeed(seed, thresholds) {
    const score = resonanceScore(seed?.signals);
    const limits = Object.assign({ sprout: 70, observe: 40 }, thresholds || {});
    const decision = score >= limits.sprout ? "sprout" : score >= limits.observe ? "observe" : "compost";
    return {
      seedId: seed?.id || null,
      score,
      decision,
      reasons: [
        `maturité ${clampSignal(seed?.signals?.maturity)}`,
        `cohérence ${clampSignal(seed?.signals?.coherence)}`,
        `utilité ${clampSignal(seed?.signals?.utility)}`,
        `confiance ${clampSignal(seed?.signals?.confidence)}`
      ],
      evaluatedAt: nowIso()
    };
  }

  global.GardenDomain = {
    SEED_KINDS,
    SEED_STATUSES,
    OPERATION_STATUSES,
    createSignals,
    createSeed,
    createSprout,
    createHarvest,
    createOperation,
    resonanceScore,
    evaluateSeed
  };
})(globalThis);
