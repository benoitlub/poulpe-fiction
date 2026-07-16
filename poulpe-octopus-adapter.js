(function poulpeOctopusAdapterModule(global) {
  "use strict";

  const TIMEOUT_MS = 30000;

  function apiBase() {
    return String(global.PoulpeRuntimeConfig?.urls?.octopusApi || global.OCTOPUS_API || "").replace(/\/$/, "");
  }

  function now() { return new Date().toISOString(); }
  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

  async function parseResponse(response) {
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch (_) { payload = { status: "failed", message: raw || `Octopus ${response.status}` }; }
    if (!response.ok) {
      const message = text(payload.message) || text(payload.error) || `Octopus ${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function normalizedStatus(value) {
    const status = String(value || "").toLowerCase();
    if (["completed", "complete", "success", "ready", "done"].includes(status)) return "ready";
    if (["failed", "error", "blocked", "cancelled"].includes(status)) return "failed";
    if (["waiting-authorization", "authorization-required", "waiting_authorization"].includes(status)) return "blocked";
    if (["queued", "accepted", "recorded"].includes(status)) return "queued";
    return "running";
  }

  function missionContext(payload) {
    const context = record(payload.context);
    const metadata = record(context.metadata);
    return {
      operationId: text(payload.operationId) || `poulpe_${Date.now()}`,
      parcelId: text(payload.parcelId) || text(context.id) || "poulpe-fiction",
      seedId: text(metadata.seedId) || text(payload.seedId) || "poulpe-fiction",
      title: text(payload.title) || "Mission Poulpe Fiction",
      intent: text(payload.objective) || text(payload.intent) || "mission",
    };
  }

  function upsertOperation(payload, status, patch = {}) {
    const context = missionContext(payload);
    try {
      return global.GardenStore?.upsertOperation?.({
        id: context.operationId,
        parcelId: context.parcelId,
        seedId: context.seedId,
        intent: context.intent,
        activity: patch.activity || context.title,
        status,
        obstacle: patch.obstacle || null,
        attempt: Number(patch.attempt || 0),
        updatedAt: now(),
      });
    } catch (_) { return null; }
  }

  function normalizeResult(payload, result) {
    const source = record(result);
    const context = missionContext(payload);
    source.operationId = text(source.operationId) || text(source.missionId) || text(source.id) || context.operationId;
    source.missionId = text(source.missionId) || text(source.id) || source.operationId;
    source.contextId = text(source.contextId) || context.parcelId;
    source.parcelId = text(source.parcelId) || source.contextId;
    source.status = text(source.status) || "running";
    return source;
  }

  function processReturn(draft, result, errorMessage) {
    if (!draft || !global.AdventureReturnProcessor) return null;
    const status = String(result?.status || "");
    if (!errorMessage && ["queued", "running", "recorded", "waiting-authorization"].includes(status)) return null;
    return global.AdventureReturnProcessor.process(draft, result, errorMessage || "");
  }

  async function dispatch(payload, options = {}) {
    const base = apiBase();
    if (!base) throw new Error("Octopus API indisponible.");
    const context = missionContext(payload);
    upsertOperation(payload, "queued", { activity: "Mission transmise à Octopus" });

    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), options.timeoutMs || TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = normalizeResult(payload, await parseResponse(response));
      const status = normalizedStatus(result.status);
      upsertOperation(payload, status, {
        activity: text(result.summary) || `Octopus · ${result.status}`,
        obstacle: status === "failed" || status === "blocked" ? { message: text(result.summary) || text(result.message) || "Mission bloquée" } : null,
      });
      const bundle = processReturn(options.draft, result, "");
      global.dispatchEvent?.(new CustomEvent("poulpe-octopus-result", { detail: { payload, result, bundle } }));
      return { result, bundle, context };
    } catch (error) {
      const message = error?.name === "AbortError" ? "Octopus n’a pas répondu dans le délai prévu." : (error instanceof Error ? error.message : "Échec Octopus");
      upsertOperation(payload, "failed", { activity: "Mission interrompue", obstacle: { message } });
      const failure = { status: "failed", summary: message, operationId: context.operationId, parcelId: context.parcelId, contextId: context.parcelId };
      const bundle = processReturn(options.draft, failure, message);
      global.dispatchEvent?.(new CustomEvent("poulpe-octopus-error", { detail: { payload, error: message, bundle } }));
      throw error instanceof Error ? error : new Error(message);
    } finally {
      global.clearTimeout(timer);
      global.GardenShell?.mount?.();
    }
  }

  function productionPayload({ plan, step, seed, execution }) {
    const operationId = `production_${seed.id || plan.seedId}_${step.id}_${Date.now()}`;
    const parcelId = seed.parcelId || plan.parcelId || "poulpe-fiction";
    const seedId = seed.id || plan.seedId;
    return {
      operationId,
      title: `Production · ${step.label}`,
      objective: `Produire ${step.label} pour ${seed.title || plan.seedTitle}`,
      context: {
        id: parcelId,
        label: seed.title || plan.seedTitle || "Poulpe Fiction",
        objective: seed.objective || plan.goal,
        metadata: {
          owner: "poulpe-fiction",
          adapter: "poulpe-octopus-v1",
          parcelId,
          seedId,
          productionPlanId: plan.id,
          productionStepId: step.id,
          requestedProducer: execution.tool,
          requestedAction: execution.action,
          requestedCapability: execution.capability,
          expectedHarvest: seed.firstHarvest || plan.expectedHarvest,
        },
      },
      requiredCapabilities: [`production.${execution.capability}`],
      authorizationPolicy: { internalWork: "allowed", externalAction: "requires-human-approval" },
      authorizedResources: ["publisher"],
      authorize: ["publisher", execution.tool].filter(Boolean),
      parcelId,
      prompt: [
        "Poulpe Fiction demande une production par l’intermédiaire exclusif d’Octopus.",
        "Octopus choisit et appelle Publisher ou un producteur compatible.",
        `Type: ${execution.capability}`,
        `Producteur souhaité: ${execution.tool}`,
        `Action souhaitée: ${execution.action}`,
        `Projet: ${seed.title || plan.seedTitle}`,
        `Objectif: ${seed.objective || plan.goal}`,
        `Récolte attendue: ${seed.firstHarvest || plan.expectedHarvest}`,
        "Retourne un artefact exploitable avec son URL ou son contenu, ou un blocage explicite.",
      ].join("\n"),
    };
  }

  async function executeProduction(input) {
    const payload = productionPayload(input);
    const dispatched = await dispatch(payload, { kind: "production" });
    return { ...dispatched, payload };
  }

  global.PoulpeOctopusAdapter = {
    version: 1,
    dispatch,
    executeProduction,
    productionPayload,
    normalizeResult,
    normalizedStatus,
  };
})(globalThis);
