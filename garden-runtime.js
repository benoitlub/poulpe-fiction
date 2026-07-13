(function gardenRuntimeModule(global) {
  "use strict";

  const CACHE_KEY = "poulpe-fiction:garden-runtime-cache:v1";
  const API_KEY = "poulpe-fiction:garden-api-url:v1";
  const DEFAULT_STATUS = "idle";

  const state = {
    loading: false,
    error: null,
    record: null,
    source: "local-fallback"
  };

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[char]));
  }

  function publisherBaseUrl() {
    try {
      return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : "";
    } catch (_) {
      return "";
    }
  }

  function configuredApiUrl() {
    try { localStorage.removeItem(API_KEY); } catch (_) {}
    return String(global.PoulpeRuntimeConfig?.urls?.publisherApi || publisherBaseUrl()).replace(/\/$/, "");
  }

  function activeContext() {
    return global.BlacklaceParcel?.activeSeed?.() || null;
  }

  function loadCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveCache(record) {
    if (!record) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  }

  function latestProductionPack(seedId) {
    const packs = global.ProductionPack?.load?.() || [];
    return packs.find((pack) => pack.seedId === seedId) || null;
  }

  function localFallback() {
    const context = activeContext();
    if (!context) {
      return {
        version: 1,
        parcelId: global.BlacklaceParcel?.PARCEL_ID || "blacklace-ecosystem",
        seedId: null,
        seedTitle: null,
        operationId: null,
        status: DEFAULT_STATUS,
        activity: "Aucune Seed active.",
        updatedAt: null,
        obstacle: null,
        harvest: null,
        nextAction: "select-seed",
        source: "local-fallback"
      };
    }

    const pack = latestProductionPack(context.seedId);
    return {
      version: 1,
      parcelId: context.parcelId,
      seedId: context.seedId,
      seedTitle: context.seedTitle,
      operationId: null,
      status: pack ? "ready" : "idle",
      activity: pack
        ? "Une récolte locale est disponible dans le Production Pack."
        : "Gérard attend une opération distante pour cette Seed.",
      updatedAt: pack?.createdAt || context.selectedAt || null,
      obstacle: null,
      harvest: pack ? {
        id: pack.id,
        title: pack.title,
        status: pack.status,
        productionPackId: pack.id,
        artifactsReady: (pack.artifacts || []).filter((item) => item.status === "ready").length,
        artifactsTotal: (pack.artifacts || []).length
      } : null,
      nextAction: pack ? "open-harvest" : "prepare",
      source: "local-fallback"
    };
  }

  function normalizeRecord(value) {
    const fallback = localFallback();
    const source = value?.value && typeof value.value === "object" ? value.value : value;
    if (!source || typeof source !== "object") return fallback;

    return {
      version: Number(source.version || 1),
      parcelId: source.parcelId || fallback.parcelId,
      seedId: source.seedId || fallback.seedId,
      seedTitle: source.seedTitle || fallback.seedTitle,
      operationId: source.operationId || null,
      status: source.status || fallback.status,
      activity: source.activity || fallback.activity,
      updatedAt: source.updatedAt || source.lastChangedAt || fallback.updatedAt,
      obstacle: source.obstacle || null,
      harvest: source.harvest || fallback.harvest,
      nextAction: source.nextAction || fallback.nextAction,
      source: "remote"
    };
  }

  function sharedStateUrl(parcelId) {
    const base = configuredApiUrl();
    if (!base || !parcelId) return "";
    return `${base}/api/global-state/garden/${encodeURIComponent(parcelId)}`;
  }

  function operationUrl() {
    const base = configuredApiUrl();
    return base ? `${base}/api/garden/operations` : "";
  }

  async function refresh(options = {}) {
    const context = activeContext();
    const parcelId = context?.parcelId || global.BlacklaceParcel?.PARCEL_ID;
    const url = sharedStateUrl(parcelId);

    state.loading = true;
    state.error = null;
    if (!options.silent) global.render?.();

    if (!url) {
      state.record = loadCache() || localFallback();
      state.source = "local-fallback";
      state.loading = false;
      global.render?.();
      return state.record;
    }

    try {
      const response = await fetch(url, { headers: { "Accept": "application/json" } });
      if (response.status === 404) {
        state.record = localFallback();
        state.source = "local-fallback";
      } else {
        if (!response.ok) throw new Error(`Garden ${response.status}`);
        state.record = normalizeRecord(await response.json());
        state.source = "remote";
        saveCache(state.record);
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Garden distant inaccessible";
      state.record = loadCache() || localFallback();
      state.source = state.record?.source === "remote" ? "remote-cache" : "local-fallback";
    }

    state.loading = false;
    global.render?.();
    return state.record;
  }

  async function createOperation(action) {
    const context = activeContext();
    const url = operationUrl();
    if (!context) return;

    if (!url) {
      state.error = "Aucun service Garden distant n'est configuré.";
      global.render?.();
      return;
    }

    state.loading = true;
    state.error = null;
    global.render?.();

    const idempotencyKey = `${context.parcelId}:${context.seedId}:${action}:v1`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          action,
          operationId: state.record?.operationId || null,
          parcelId: context.parcelId,
          seedId: context.seedId,
          seedTitle: context.seedTitle,
          objective: context.objective,
          expectedHarvest: context.firstHarvest,
          authorizationPolicy: {
            internalWork: "allowed",
            externalAction: "requires-human-approval"
          }
        })
      });
      if (!response.ok) throw new Error(`Garden ${response.status}`);
      state.record = normalizeRecord(await response.json());
      state.source = "remote";
      saveCache(state.record);
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Impossible de créer l'opération";
    }

    state.loading = false;
    global.render?.();
  }

  function statusLabel(status) {
    return ({
      idle: "En attente",
      queued: "Dans la file",
      running: "Gérard travaille",
      paused: "En pause",
      blocked: "Bloqué",
      ready: "Récolte prête",
      failed: "Échec explicite"
    })[status] || status || "Inconnu";
  }

  function sourceLabel(source) {
    return ({
      remote: "Distant",
      "remote-cache": "Cache distant",
      "local-fallback": "Secours local"
    })[source] || source;
  }

  function timeLabel(value) {
    if (!value) return "Aucun changement enregistré";
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function render() {
    const context = activeContext();
    const record = state.record || loadCache() || localFallback();
    const status = record.status || DEFAULT_STATUS;
    const obstacle = record.obstacle;
    const harvest = record.harvest;
    const canPrepare = Boolean(context) && ["idle", "failed"].includes(status);
    const canResume = Boolean(context) && ["paused", "blocked"].includes(status);

    const errorHtml = state.error
      ? `<div class="garden-alert error"><strong>Connexion distante</strong><span>${esc(state.error)}</span></div>`
      : "";
    const obstacleHtml = obstacle
      ? `<div class="garden-alert warning"><strong>${esc(obstacle.title || "Obstacle")}</strong><span>${esc(obstacle.message || obstacle.reason || "Une information manque pour continuer.")}</span>${obstacle.requiredField ? `<label>${esc(obstacle.requiredField.label || obstacle.requiredField.name || "Information requise")}<input data-garden-obstacle-field="${esc(obstacle.requiredField.name || "value")}" value="${esc(obstacle.requiredField.value || "")}" placeholder="${esc(obstacle.requiredField.placeholder || "Compléter ici")}" /></label><button class="primary" data-garden-action="resolve">Envoyer</button>` : ""}</div>`
      : "";
    const harvestHtml = harvest
      ? `<div class="garden-harvest"><div><p class="eyebrow">🌾 Récolte</p><strong>${esc(harvest.title || "Production Pack disponible")}</strong><small>${Number(harvest.artifactsReady || 0)}/${Number(harvest.artifactsTotal || 0)} artefact(s) prêt(s)</small></div><button class="primary" data-garden-open-harvest>Ouvrir</button></div>`
      : "";

    return `<section class="garden-runtime" data-garden-status="${esc(status)}"><div class="garden-runtime-head"><div><p class="eyebrow">Activité de Gérard</p><h3>${esc(context?.seedTitle || "Aucune Seed active")}</h3></div><div class="garden-runtime-meta"><span class="garden-status">${esc(statusLabel(status))}</span><span>${esc(sourceLabel(state.source || record.source))}</span></div></div><p class="garden-activity">${esc(record.activity || "Aucune activité enregistrée.")}</p><div class="garden-facts"><span><strong>Dernier changement</strong>${esc(timeLabel(record.updatedAt))}</span><span><strong>Opération</strong>${esc(record.operationId || "Pas encore créée")}</span></div>${errorHtml}${obstacleHtml}${harvestHtml}<div class="garden-actions"><button class="ghost" data-garden-refresh ${state.loading ? "disabled" : ""}>${state.loading ? "Actualisation…" : "Actualiser"}</button>${canPrepare ? `<button class="primary" data-garden-action="prepare">Préparer le travail</button>` : ""}${canResume ? `<button class="primary" data-garden-action="resume">Reprendre</button>` : ""}<details class="garden-settings"><summary>Connexion</summary><label>URL du service Garden<input id="gardenApiUrl" value="${esc(configuredApiUrl())}" readonly /></label><small>Production verrouillee sur Render. Les overrides localStorage sont ignores.</small></details></div></section>`;
  }

  function bind() {
    const refreshButton = document.querySelector("[data-garden-refresh]");
    if (refreshButton) refreshButton.onclick = () => refresh();

    document.querySelectorAll("[data-garden-action]").forEach((button) => {
      button.onclick = async () => {
        const action = button.dataset.gardenAction;
        if (action === "resolve") {
          const input = document.querySelector("[data-garden-obstacle-field]");
          await createOperation("resolve-obstacle", { value: input?.value || "" });
          return;
        }
        await createOperation(action);
      };
    });

    const saveApi = document.querySelector("[data-garden-save-api]");
    if (saveApi) saveApi.onclick = () => {
      localStorage.removeItem(API_KEY);
      refresh();
    };

    const openHarvest = document.querySelector("[data-garden-open-harvest]");
    if (openHarvest) openHarvest.onclick = () => {
      const pack = latestProductionPack(activeContext()?.seedId);
      if (!pack) return;
      const html = global.ProductionPack?.render?.(pack);
      if (!html) return;
      const existing = document.querySelector(".production-pack");
      if (existing) existing.scrollIntoView({ behavior: "smooth", block: "start" });
      else {
        const panel = document.querySelector(".garden-runtime");
        panel?.insertAdjacentHTML("afterend", html);
        global.ProductionPack?.bind?.(pack);
      }
    };
  }

  global.GardenRuntime = {
    CACHE_KEY,
    API_KEY,
    state,
    refresh,
    createOperation,
    render,
    bind,
    configuredApiUrl,
    localFallback
  };

  const baseRender = global.render;
  global.render = function renderWithGardenRuntime() {
    baseRender();
    if (global.state?.step !== "objective") return;
    const parcel = document.querySelector(".blacklace-parcel");
    if (parcel && !document.querySelector(".garden-runtime")) {
      parcel.insertAdjacentHTML("afterend", render());
    }
    bind();
  };

  global.render();
  void refresh({ silent: true });
})(globalThis);
