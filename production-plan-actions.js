(function productionPlanActions(global) {
  "use strict";

  if (global.__productionPlanActionsBound) return;
  global.__productionPlanActionsBound = true;

  function activeSeed(plan) {
    const gardenSeed = global.GardenStore?.activeSeed?.();
    if (gardenSeed) return gardenSeed;
    const context = global.BlacklaceParcel?.activeSeed?.();
    const legacy = global.BlacklaceParcel?.parcel?.seeds?.find?.((seed) => seed.id === context?.seedId);
    return legacy || context || (plan ? { id: plan.seedId, title: plan.seedTitle, objective: plan.goal, firstHarvest: plan.expectedHarvest, parcelId: plan.parcelId } : null);
  }

  function savePlanStep(plan, stepId, patch) {
    const next = Object.assign({}, plan, {
      updatedAt: new Date().toISOString(),
      steps: (plan.steps || []).map((step) => step.id === stepId ? Object.assign({}, step, patch) : step)
    });
    global.ProductionPlan?.save?.(next);
    return next;
  }

  function htmlDownloadUrl(content) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(String(content || ""))}`;
  }

  function findArtifact(result) {
    const output = result?.output && typeof result.output === "object" ? result.output : {};
    const candidates = [
      ...(Array.isArray(result?.artifacts) ? result.artifacts : []),
      ...(Array.isArray(output?.artifacts) ? output.artifacts : []),
      ...(Array.isArray(output?.harvests) ? output.harvests : []),
      result?.artifact,
      output?.artifact,
      output?.deliverable,
    ].filter(Boolean);
    return candidates[0] || null;
  }

  function extractArtifact(result, seed, step) {
    const artifact = findArtifact(result) || {};
    const output = result?.output && typeof result.output === "object" ? result.output : {};
    const content = String(artifact?.content || artifact?.text || artifact?.description || output?.text || output?.content || result?.summary || "");
    return {
      id: artifact?.id || `artifact_${step.id}_${Date.now()}`,
      title: artifact?.title || artifact?.name || `${step.label} · ${seed.title || seed.id}`,
      content,
      type: artifact?.type || artifact?.kind || step.type,
      mimeType: artifact?.mimeType || (step.type === "landing-page" ? "text/html" : "text/plain"),
      url: artifact?.url || artifact?.viewUrl || artifact?.editUrl || output?.url || null,
      downloadUrl: artifact?.downloadUrl || (content && step.type === "landing-page" ? htmlDownloadUrl(content) : null),
      raw: artifact
    };
  }

  function addHarvest(plan, seed, step, artifact, operationId, result) {
    if (!global.GardenStore?.addHarvest) return null;
    return global.GardenStore.addHarvest({
      id: `harvest_${operationId}`,
      parcelId: seed.parcelId || plan.parcelId || "poulpe-fiction",
      seedId: seed.id || plan.seedId,
      operationId,
      title: artifact.title,
      preview: artifact.content.slice(0, 280),
      status: "ready",
      type: step.type,
      content: { text: artifact.content },
      payload: { adapter: "poulpe-octopus-v1", result, artifact: artifact.raw },
      url: artifact.url,
      downloadUrl: artifact.downloadUrl
    });
  }

  function showError(button, message) {
    button.disabled = false;
    button.textContent = "Réessayer";
    let alert = button.parentElement?.querySelector?.(".production-action-error");
    if (!alert) {
      alert = document.createElement("p");
      alert.className = "production-action-error";
      alert.setAttribute("role", "alert");
      button.insertAdjacentElement("afterend", alert);
    }
    alert.textContent = message;
  }

  function openLocalTechnique(button, message) {
    const frontend = global.PoulpeRuntimeConfig?.urls?.publisherFrontend;
    if (!frontend) return showError(button, message || "Le Local technique Publisher est indisponible.");
    global.location.href = `${frontend.replace(/\/$/, "")}/local-technique`;
  }

  function executionFor(step) {
    const provider = String(step?.provider || "").toLowerCase();
    const type = String(step?.type || "").toLowerCase();
    if (global.ProductionPlan?.isInternalProvider?.(step.provider) || type === "landing-page") return { tool: "html-local", action: "create_landing_page", capability: "landing-page" };
    if (provider.includes("canva") || type === "social-visual") return { tool: "canva", action: "create_design", capability: "social-visual" };
    if (provider.includes("eleven") || type === "voice-over") return { tool: "elevenlabs", action: "create_voice_over", capability: "voice-over" };
    if (provider.includes("kling") || provider.includes("runway") || type === "vertical-video") return { tool: provider.includes("runway") ? "runway" : "kling", action: "create_video", capability: "video" };
    if (provider.includes("metricool") || type === "publication") return { tool: "metricool", action: "publish", capability: "publish" };
    return null;
  }

  async function executeStep(button) {
    const plan = global.ProductionPlan?.current?.();
    const stepId = button.dataset.productionPlanAction;
    const step = plan?.steps?.find?.((item) => item.id === stepId);
    const seed = activeSeed(plan);
    if (!plan || !step || !seed) return showError(button, "Plan ou Seed introuvable.");

    const internal = global.ProductionPlan?.isInternalProvider?.(step.provider);
    const authorized = internal || (step.executable === true && step.authorization === "granted" && ["connected", "confirmed", "available"].includes(String(step.providerStatus)));
    if (!authorized) return openLocalTechnique(button, `${step.provider || "Ce producteur"} n’est pas encore autorisé.`);

    const execution = executionFor(step);
    if (!execution) return showError(button, `Aucune capacité Octopus n’est définie pour ${step.provider || step.type}.`);
    if (!global.PoulpeOctopusAdapter?.executeProduction) return showError(button, "Adaptateur Poulpe → Octopus indisponible.");

    button.disabled = true;
    button.textContent = "Octopus organise la production…";
    savePlanStep(plan, step.id, { status: "producing", error: null, adapter: "poulpe-octopus-v1" });

    try {
      const { result, payload } = await global.PoulpeOctopusAdapter.executeProduction({ plan, step, seed, execution });
      const status = String(result?.status || "").toLowerCase();
      if (["waiting-authorization", "authorization-required"].includes(status)) {
        savePlanStep(global.ProductionPlan.current(), step.id, { status: "waiting-authorization", operationId: payload.operationId, error: result?.summary || "Une autorisation est requise." });
        return showError(button, result?.summary || "Octopus attend une autorisation externe.");
      }
      if (!["completed", "complete", "success", "ready", "done"].includes(status)) {
        savePlanStep(global.ProductionPlan.current(), step.id, { status: "running", operationId: payload.operationId, error: null });
        button.disabled = false;
        button.textContent = "Actualiser la mission";
        return;
      }

      const artifact = extractArtifact(result, seed, step);
      if (!artifact.content && !artifact.url) throw new Error("Octopus a terminé la mission sans artefact exploitable.");
      addHarvest(plan, seed, step, artifact, payload.operationId, result);
      savePlanStep(global.ProductionPlan.current(), step.id, {
        status: "ready",
        providerStatus: "confirmed",
        executable: true,
        artifactId: artifact.id,
        operationId: payload.operationId,
        error: null,
        adapter: "poulpe-octopus-v1"
      });
      if (typeof global.render === "function") global.render();
      global.GardenPersistence?.selectView?.("harvests");
    } catch (error) {
      savePlanStep(global.ProductionPlan.current(), step.id, {
        status: "blocked",
        error: error instanceof Error ? error.message : "Erreur de production",
        adapter: "poulpe-octopus-v1"
      });
      showError(button, error instanceof Error ? error.message : "Erreur de production");
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-production-plan-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    void executeStep(button);
  });
})(globalThis);
