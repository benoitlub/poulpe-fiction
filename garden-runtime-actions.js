(function gardenRuntimeActions(global) {
  "use strict";

  function octopusBaseUrl() {
    return String(global.PoulpeRuntimeConfig?.urls?.octopusApi || global.OCTOPUS_API || "https://octopus-engine.onrender.com").replace(/\/$/, "");
  }

  function context() {
    return global.BlacklaceParcel?.activeSeed?.() || null;
  }

  function expectedHarvests(current) {
    const value = current?.expectedHarvests || current?.firstHarvest;
    if (Array.isArray(value)) return value.filter(Boolean);
    const text = String(value || "").toLowerCase();
    const result = [];
    if (text.includes("landing") || text.includes("page")) result.push("landing-page");
    if (text.includes("instagram") || text.includes("visuel")) result.push("instagram-visual");
    return result.length ? result : ["landing-page"];
  }

  function artifactText(artifact) {
    if (!artifact) return "";
    if (typeof artifact.content === "string") return artifact.content;
    if (artifact.content && typeof artifact.content.text === "string") return artifact.content.text;
    if (typeof artifact.text === "string") return artifact.text;
    return "";
  }

  function saveMissionHarvest(current, payload) {
    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    if (!artifacts.length || !global.AdventureReturnProcessor?.OUTBOX_KEY) return null;
    let previous = [];
    try { previous = JSON.parse(localStorage.getItem(global.AdventureReturnProcessor.OUTBOX_KEY) || "[]"); } catch (_) {}
    const createdAt = new Date().toISOString();
    const bundle = {
      version: 1,
      id: `return_${payload.operationId || Date.now()}`,
      status: "ready",
      deliveryStatus: "harvests-created",
      parcelId: current.parcelId,
      missionId: payload.operationId || null,
      createdAt,
      harvests: artifacts.map((artifact, index) => ({
        id: artifact.id || `harvest_${Date.now()}_${index}`,
        kind: "harvest",
        parcelId: current.parcelId,
        missionId: payload.operationId || null,
        title: artifact.title || `Récolte ${index + 1}`,
        description: artifactText(artifact).slice(0, 240),
        artifactType: artifact.kind || artifact.type || "text",
        artifact: artifactText(artifact),
        createdAt,
        rawArtifact: artifact,
      })),
      seeds: [], questions: [], learnings: [], failure: null, rawMission: payload,
    };
    const next = [bundle, ...(Array.isArray(previous) ? previous.filter((item) => item.id !== bundle.id) : [])].slice(0, 50);
    localStorage.setItem(global.AdventureReturnProcessor.OUTBOX_KEY, JSON.stringify(next));
    return bundle;
  }

  function projectRuntime(current, payload) {
    const status = payload?.status === "completed" ? "ready" : payload?.status === "waiting-authorization" ? "blocked" : "failed";
    const bundle = saveMissionHarvest(current, payload);
    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    const record = {
      version: 1,
      parcelId: current.parcelId,
      seedId: current.seedId,
      seedTitle: current.seedTitle,
      operationId: payload?.operationId || null,
      status,
      activity: payload?.summary || (status === "ready" ? "Octopus a terminé la mission." : status === "blocked" ? "Octopus attend une autorisation." : "La mission a échoué."),
      updatedAt: new Date().toISOString(),
      obstacle: status === "blocked" ? { title: "Autorisation requise", message: "Une action externe doit être autorisée avant de continuer." } : null,
      harvest: bundle ? {
        id: bundle.id,
        title: artifacts[0]?.title || "Récolte Octopus",
        status: "ready",
        productionPackId: bundle.id,
        artifactsReady: artifacts.length,
        artifactsTotal: artifacts.length,
      } : null,
      nextAction: status === "ready" ? "open-harvest" : status === "blocked" ? "authorize" : "prepare",
      source: "remote",
    };
    if (global.GardenRuntime?.state) {
      global.GardenRuntime.state.record = record;
      global.GardenRuntime.state.source = "remote";
      global.GardenRuntime.state.error = null;
    }
    try { localStorage.setItem(global.GardenRuntime.CACHE_KEY, JSON.stringify(record)); } catch (_) {}
    return record;
  }

  async function postOperation(action, extra = {}) {
    const current = context();
    const base = octopusBaseUrl();
    if (!current || !base) throw new Error("Aucune parcelle active ou Octopus indisponible.");

    const operationId = global.GardenRuntime?.state?.record?.operationId || `mission_${current.seedId}_${Date.now()}`;
    const response = await fetch(`${base}/mission`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        operationId,
        title: current.seedTitle || `Mission ${current.seedId}`,
        objective: current.objective || current.firstHarvest || "Produire une récolte utile.",
        context: {
          id: current.parcelId,
          label: current.seedTitle || current.parcelId,
          objective: current.objective || current.firstHarvest || "Produire une récolte utile.",
          metadata: {
            owner: "poulpe-fiction",
            seedId: current.seedId,
            action,
            expectedHarvests: expectedHarvests(current),
            input: extra,
          },
        },
        requiredCapabilities: ["campaign.generate"],
        authorizedResources: ["mistral"],
        prompt: `Mission ${action}. ${current.objective || current.firstHarvest || "Produis un résultat exploitable."}`,
      }),
    });

    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch (_) { throw new Error(`Octopus ${response.status}: ${text.slice(0, 240)}`); }
    if (!response.ok) throw new Error(payload?.message || payload?.error || `Octopus ${response.status}`);
    projectRuntime(current, payload);
    global.render?.();
    return payload;
  }

  function bindObstacleSubmission() {
    const button = document.querySelector('[data-garden-action="resolve"]');
    if (!button) return;
    button.onclick = async () => {
      const field = document.querySelector("[data-garden-obstacle-field]");
      button.disabled = true;
      try {
        await postOperation("resolve-obstacle", { field: field?.dataset.gardenObstacleField || "value", value: field?.value || "" });
      } catch (error) {
        global.GardenRuntime.state.error = error instanceof Error ? error.message : "Impossible d'envoyer l'information";
        global.render?.();
      } finally { button.disabled = false; }
    };
  }

  function bindHarvestPreview() {
    const button = document.querySelector("[data-garden-open-harvest]");
    if (!button) return;
    button.onclick = () => {
      const seedId = context()?.seedId;
      const pack = (global.ProductionPack?.load?.() || []).find((item) => item.seedId === seedId);
      if (pack) {
        let section = document.querySelector(".production-pack");
        if (!section) {
          const html = global.ProductionPack?.render?.(pack);
          const runtime = document.querySelector(".garden-runtime");
          if (html && runtime) { runtime.insertAdjacentHTML("afterend", html); section = document.querySelector(".production-pack"); }
        }
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      document.querySelector(".adventure-return")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  function bindExternalApproval() {
    document.querySelectorAll("[data-garden-external-action]").forEach((button) => {
      button.onclick = async () => {
        const action = button.dataset.gardenExternalAction;
        button.disabled = true;
        try { await postOperation("authorize-external-action", { action }); }
        catch (error) { global.GardenRuntime.state.error = error instanceof Error ? error.message : "Autorisation impossible"; global.render?.(); }
        finally { button.disabled = false; }
      };
    });
  }

  function bindPrimaryActions() {
    document.querySelectorAll('[data-garden-action="prepare"], [data-garden-action="resume"]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try { await postOperation(button.dataset.gardenAction || "prepare"); }
        catch (error) { global.GardenRuntime.state.error = error instanceof Error ? error.message : "Mission impossible"; global.render?.(); }
        finally { button.disabled = false; }
      };
    });
  }

  function bindAll() {
    bindObstacleSubmission();
    bindHarvestPreview();
    bindExternalApproval();
    bindPrimaryActions();
  }

  global.GardenRuntimeActions = { postOperation, projectRuntime, bindAll };
  const previousRender = global.render;
  global.render = function renderWithGardenActions() { previousRender(); bindAll(); };
  bindAll();
})(globalThis);
