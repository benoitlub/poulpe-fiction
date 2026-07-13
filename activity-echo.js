(function activityEchoModule(global) {
  "use strict";

  const EMPTY_MESSAGE = "Le jardin est calme. Gérard l’a décidé.";

  function esc(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      "\"": "&quot;"
    }[char]));
  }

  function compact(value) {
    return String(value || "").trim();
  }

  function event(input) {
    return {
      id: compact(input.id) || `${compact(input.type) || "activity"}_${compact(input.createdAt) || Date.now()}`,
      type: compact(input.type) || "garden",
      label: compact(input.label),
      detail: compact(input.detail),
      createdAt: compact(input.createdAt) || new Date().toISOString(),
      tone: compact(input.tone) || "neutral"
    };
  }

  function stableTime(value) {
    return compact(value) || new Date().toISOString();
  }

  function addUnique(events, next) {
    if (!next?.label) return;
    if (events.some((item) => item.id === next.id || (item.type === next.type && item.detail === next.detail))) return;
    events.push(next);
  }

  function collectEvents(sources = {}) {
    const events = [];
    const runtimeState = sources.runtimeState || global.GardenRuntime?.state || {};
    const runtimeRecord = sources.runtimeRecord || runtimeState.record || null;
    const runtimeError = sources.runtimeError ?? runtimeState.error;
    const activeSeed = sources.activeSeed !== undefined
      ? sources.activeSeed
      : (global.BlacklaceParcel?.activeSeed?.() || global.GardenStore?.activeSeed?.() || null);
    const draft = sources.draft !== undefined ? sources.draft : global.AdventureDraft?.load?.();
    const bundles = sources.returnBundles || global.AdventureReturnProcessor?.loadOutbox?.() || [];

    if (activeSeed?.id) {
      addUnique(events, event({
        id: `seed:${activeSeed.id}`,
        type: "seed-spotted",
        label: "Nouvelle graine repérée",
        detail: activeSeed.title || activeSeed.seedTitle || activeSeed.id,
        createdAt: stableTime(activeSeed.updatedAt || activeSeed.createdAt),
        tone: "success"
      }));
    }

    if (runtimeState.loading) {
      addUnique(events, event({
        id: "garden:observing",
        type: "garden-observing",
        label: "Gérard observe",
        detail: "Actualisation du Garden en cours.",
        createdAt: new Date().toISOString(),
        tone: "active"
      }));
    }

    if (runtimeRecord?.activity) {
      const status = compact(runtimeRecord.status);
      const label = ["queued", "running"].includes(status)
        ? "Une tentative est en cours"
        : ["blocked", "failed"].includes(status)
          ? "Une épine bloque la sortie"
          : "Gérard observe";
      addUnique(events, event({
        id: `garden:${runtimeRecord.operationId || runtimeRecord.updatedAt || status}`,
        type: status ? `garden-${status}` : "garden-activity",
        label,
        detail: runtimeRecord.activity,
        createdAt: stableTime(runtimeRecord.updatedAt),
        tone: ["blocked", "failed"].includes(status) ? "error" : "active"
      }));
    }

    if (runtimeRecord?.harvest) {
      addUnique(events, event({
        id: `harvest:${runtimeRecord.harvest.id || runtimeRecord.operationId || runtimeRecord.updatedAt}`,
        type: "harvest-returned",
        label: "Une récolte revient au Garden",
        detail: runtimeRecord.harvest.title || "Récolte disponible",
        createdAt: stableTime(runtimeRecord.updatedAt),
        tone: "success"
      }));
    }

    if (runtimeError) {
      addUnique(events, event({
        id: `thorn:${runtimeError}`,
        type: "thorn-blocking",
        label: "Une épine bloque la sortie",
        detail: runtimeError,
        tone: "error"
      }));
    }

    if (draft?.id && draft.status !== "cancelled") {
      addUnique(events, event({
        id: `draft:${draft.id}`,
        type: "bag-prepared",
        label: "Gérard prépare son sac",
        detail: draft.objective || draft.curiosity?.title || draft.id,
        createdAt: stableTime(draft.updatedAt || draft.createdAt),
        tone: draft.status === "validated" ? "success" : "active"
      }));
      (draft.grafts || []).forEach((graft) => addUnique(events, event({
        id: `graft:${draft.id}:${graft}`,
        type: "graft-consulted",
        label: "Un greffon est consulté",
        detail: graft,
        createdAt: stableTime(draft.updatedAt || draft.createdAt),
        tone: "neutral"
      })));
    }

    bundles.slice(0, 3).forEach((bundle) => {
      if (bundle.failure) {
        addUnique(events, event({
          id: `failure:${bundle.id}`,
          type: "thorn-blocking",
          label: "Une épine bloque la sortie",
          detail: bundle.failure.reason,
          createdAt: stableTime(bundle.createdAt),
          tone: "error"
        }));
      }
      (bundle.harvests || []).forEach((harvest) => addUnique(events, event({
        id: `return-harvest:${harvest.id}`,
        type: "harvest-returned",
        label: "Une récolte revient au Garden",
        detail: harvest.title,
        createdAt: stableTime(harvest.createdAt || bundle.createdAt),
        tone: "success"
      })));
      (bundle.seeds || []).forEach((seed) => addUnique(events, event({
        id: `return-seed:${seed.id}`,
        type: "seed-spotted",
        label: "Nouvelle graine repérée",
        detail: seed.title,
        createdAt: stableTime(seed.createdAt || bundle.createdAt),
        tone: "success"
      })));
    });

    return events.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 8);
  }

  function render(events) {
    const items = Array.isArray(events) ? events : [];
    if (items.length === 0) {
      return `<section class="activity-echo"><p class="eyebrow">Écho du Garden</p><p class="activity-echo-empty">${esc(EMPTY_MESSAGE)}</p></section>`;
    }
    return `<section class="activity-echo"><p class="eyebrow">Écho du Garden</p><div class="activity-echo-list">${items.map((item) => `<article class="activity-echo-item ${esc(item.tone)}"><div><strong>${esc(item.label)}</strong>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</div><small>${esc(item.type)}</small></article>`).join("")}</div></section>`;
  }

  function mount() {
    if (typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root) return;
    const html = render(collectEvents());
    const existing = root.querySelector(".activity-echo");
    if (existing) {
      existing.outerHTML = html;
      return;
    }
    const anchor = root.querySelector(".garden-runtime") || root.querySelector(".adventure-return") || root.querySelector(".greenhouse") || root.querySelector(".panel");
    if (anchor) anchor.insertAdjacentHTML("afterend", html);
    else root.insertAdjacentHTML("beforeend", html);
  }

  global.ActivityEcho = { EMPTY_MESSAGE, collectEvents, render, mount };

  if (typeof global.render === "function") {
    const baseRender = global.render;
    global.render = function renderWithActivityEcho() {
      baseRender();
      mount();
    };
    global.render();
  }
})(globalThis);
