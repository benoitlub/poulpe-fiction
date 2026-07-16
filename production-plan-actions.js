(function productionPlanActions(global) {
  "use strict";

  if (global.__productionPlanActionsBound) return;
  global.__productionPlanActionsBound = true;

  function publisherBaseUrl() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
    catch (_) { return ""; }
  }

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

  function extractArtifact(payload, seed, step) {
    const artifact = payload?.artifact || payload?.artifacts?.[0] || payload;
    const content = String(artifact?.content || artifact?.text || payload?.content || "");
    return {
      id: artifact?.id || `artifact_${step.id}_${Date.now()}`,
      title: artifact?.title || `${step.label} · ${seed.title || seed.id}`,
      content,
      type: artifact?.type || step.type,
      mimeType: artifact?.mimeType || (step.type === "landing-page" ? "text/html" : "text/plain"),
      url: artifact?.url || artifact?.viewUrl || payload?.url || null,
      downloadUrl: artifact?.downloadUrl || (content ? htmlDownloadUrl(content) : null),
      raw: artifact
    };
  }

  function addHarvest(plan, seed, step, artifact, operationId, payload) {
    if (!global.GardenStore?.addHarvest) return null;
    return global.GardenStore.addHarvest({
      id: `harvest_${operationId}`,
      parcelId: seed.parcelId || plan.parcelId || "blacklace-ecosystem",
      seedId: seed.id || plan.seedId,
      operationId,
      title: artifact.title,
      preview: artifact.content.slice(0, 280),
      status: "ready",
      type: step.type,
      content: { text: artifact.content },
      payload: { plan: payload?.plan || null, producer: payload?.tool || step.provider || "publisher", artifact: artifact.raw },
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

    if (global.ProductionPlan?.isInternalProvider?.(step.provider) || type === "landing-page") {
      return { tool: "html-local", action: "create_landing_page", capability: "landing-page" };
    }
    if (provider.includes("canva") || type === "social-visual") {
      return { tool: "canva", action: "create_design", capability: "social-visual" };
    }
    if (provider.includes("eleven") || type === "voice-over") {
      return { tool: "elevenlabs", action: "create_voice_over", capability: "voice-over" };
    }
    if (provider.includes("kling") || provider.includes("runway") || type === "vertical-video") {
      return { tool: provider.includes("runway") ? "runway" : "kling", action: "create_video", capability: "video" };
    }
    if (provider.includes("metricool") || type === "publication") {
      return { tool: "metricool", action: "publish", capability: "publish" };
    }
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
    if (!authorized) {
      openLocalTechnique(button, `${step.provider || "Ce producteur"} n’est pas encore autorisé.`);
      return;
    }

    const execution = executionFor(step);
    if (!execution) return showError(button, `Aucune action Publisher n’est encore définie pour ${step.provider || step.type}.`);

    const base = publisherBaseUrl();
    if (!base) return showError(button, "Publisher API indisponible.");

    const operationId = `production_${seed.id || plan.seedId}_${step.id}_${Date.now()}`;
    button.disabled = true;
    button.textContent = "Production en cours…";
    savePlanStep(plan, step.id, { status: "producing", operationId, error: null });

    try {
      const response = await fetch(`${base}/api/production/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          requestId: operationId,
          tool: execution.tool,
          action: execution.action,
          capability: execution.capability,
          context: {
            parcelId: seed.parcelId || plan.parcelId || "blacklace-ecosystem",
            seedId: seed.id || plan.seedId,
            productionPlanId: plan.id,
            productionStepId: step.id
          },
          input: {
            title: seed.title || plan.seedTitle,
            objective: seed.objective || plan.goal,
            expectedHarvest: seed.firstHarvest || plan.expectedHarvest,
            format: step.type === "social-visual" ? "instagram-post" : step.type,
            callToAction: "Découvrir le projet"
          }
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !["completed", "ready"].includes(String(payload.status))) {
        throw new Error(payload?.error || payload?.summary || `Publisher a répondu ${response.status}.`);
      }

      const artifact = extractArtifact(payload, seed, step);
      if (!artifact.content && !artifact.url) throw new Error("Production terminée sans artefact exploitable.");

      addHarvest(plan, seed, step, artifact, operationId, payload);
      savePlanStep(global.ProductionPlan.current(), step.id, {
        status: "ready",
        providerStatus: "confirmed",
        executable: true,
        artifactId: artifact.id,
        operationId,
        error: null
      });

      try {
        global.GardenStore?.upsertOperation?.({
          id: operationId,
          parcelId: seed.parcelId || plan.parcelId || "blacklace-ecosystem",
          seedId: seed.id || plan.seedId,
          intent: `produce-${step.type}`,
          status: "ready",
          activity: `${step.label} produite`
        });
      } catch (_) {}

      if (typeof global.render === "function") global.render();
      global.GardenPersistence?.selectView?.("harvests");
    } catch (error) {
      savePlanStep(global.ProductionPlan.current(), step.id, {
        status: "ready-to-produce",
        error: error instanceof Error ? error.message : "Erreur de production"
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
