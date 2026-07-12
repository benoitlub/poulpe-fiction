(function gardenRuntimeActions(global) {
  "use strict";

  function baseUrl() {
    return global.GardenRuntime?.configuredApiUrl?.() || "";
  }

  function context() {
    return global.BlacklaceParcel?.activeSeed?.() || null;
  }

  async function postOperation(action, extra = {}) {
    const current = context();
    const base = baseUrl();
    if (!current || !base) return;

    const idempotencyKey = `${current.parcelId}:${current.seedId}:${action}:v1`;
    const response = await fetch(`${base}/api/garden/operations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        action,
        operationId: global.GardenRuntime?.state?.record?.operationId || null,
        parcelId: current.parcelId,
        seedId: current.seedId,
        seedTitle: current.seedTitle,
        objective: current.objective,
        expectedHarvest: current.firstHarvest,
        input: extra,
        authorizationPolicy: {
          internalWork: "allowed",
          externalAction: "requires-human-approval"
        }
      })
    });

    if (!response.ok) throw new Error(`Garden ${response.status}`);
    return response.json();
  }

  function bindObstacleSubmission() {
    const button = document.querySelector('[data-garden-action="resolve"]');
    if (!button) return;

    button.onclick = async () => {
      const field = document.querySelector("[data-garden-obstacle-field]");
      button.disabled = true;
      try {
        await postOperation("resolve-obstacle", {
          field: field?.dataset.gardenObstacleField || "value",
          value: field?.value || ""
        });
        await global.GardenRuntime?.refresh?.();
      } catch (error) {
        global.GardenRuntime.state.error = error instanceof Error ? error.message : "Impossible d'envoyer l'information";
        global.render?.();
      } finally {
        button.disabled = false;
      }
    };
  }

  function bindHarvestPreview() {
    const button = document.querySelector("[data-garden-open-harvest]");
    if (!button) return;

    button.onclick = () => {
      const seedId = context()?.seedId;
      const pack = (global.ProductionPack?.load?.() || []).find((item) => item.seedId === seedId);
      if (!pack) return;

      let section = document.querySelector(".production-pack");
      if (!section) {
        const html = global.ProductionPack?.render?.(pack);
        const runtime = document.querySelector(".garden-runtime");
        if (!html || !runtime) return;
        runtime.insertAdjacentHTML("afterend", html);
        section = document.querySelector(".production-pack");
      }

      document.querySelectorAll("[data-production-preview]").forEach((previewButton) => {
        previewButton.onclick = () => {
          const artifact = pack.artifacts.find((item) => item.id === previewButton.dataset.productionPreview);
          if (!artifact?.content) return;
          const blob = new Blob([artifact.content], { type: artifact.mimeType || "text/html" });
          const url = URL.createObjectURL(blob);
          global.open(url, "_blank", "noopener,noreferrer");
          global.setTimeout(() => URL.revokeObjectURL(url), 60000);
        };
      });

      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  function bindExternalApproval() {
    document.querySelectorAll("[data-garden-external-action]").forEach((button) => {
      button.onclick = async () => {
        const action = button.dataset.gardenExternalAction;
        button.disabled = true;
        try {
          await postOperation("authorize-external-action", { action });
          await global.GardenRuntime?.refresh?.();
        } catch (error) {
          global.GardenRuntime.state.error = error instanceof Error ? error.message : "Autorisation impossible";
          global.render?.();
        } finally {
          button.disabled = false;
        }
      };
    });
  }

  function bindAll() {
    bindObstacleSubmission();
    bindHarvestPreview();
    bindExternalApproval();
  }

  const previousRender = global.render;
  global.render = function renderWithGardenActions() {
    previousRender();
    bindAll();
  };

  bindAll();
})(globalThis);
