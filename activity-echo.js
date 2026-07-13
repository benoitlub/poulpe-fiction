(function activityEchoModule(global) {
  "use strict";

  const EMPTY_MESSAGE = "Le jardin est calme. Gérard l’a décidé.";
  const POLES = [
    { id: "radar", label: "Radar", x: 28, y: 38 },
    { id: "observatoire", label: "Observatoire", x: 82, y: 24 },
    { id: "publisher", label: "Publisher", x: 158, y: 46 },
    { id: "octopus", label: "Octopus", x: 138, y: 112 },
    { id: "garden", label: "Garden", x: 52, y: 110 },
  ];
  const LINKS = [
    ["radar", "observatoire"],
    ["observatoire", "publisher"],
    ["publisher", "octopus"],
    ["octopus", "garden"],
    ["garden", "radar"],
    ["observatoire", "octopus"],
    ["publisher", "garden"],
  ];
  const STATUS_LABEL = {
    calme: EMPTY_MESSAGE,
    observation: "Gérard observe.",
    reflexion: "Gérard réfléchit.",
    preparation: "Gérard prépare.",
    experimentation: "Gérard expérimente.",
    recolte: "Gérard récolte.",
    blocage: "Gérard est bloqué.",
    reussite: "Gérard a réussi.",
  };

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

  function timestamp(value) {
    const parsed = Date.parse(compact(value));
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function polePos(id) {
    return POLES.find((pole) => pole.id === id) || POLES[4];
  }

  function linkKey(a, b) {
    return [a, b].sort().join("-");
  }

  function poleName(pole) {
    return { radar: "Radar", observatoire: "Observatoire", publisher: "Publisher", octopus: "Octopus", garden: "Garden" }[pole] || pole;
  }

  function event(input) {
    return {
      id: compact(input.id) || `${compact(input.pole) || "activity"}_${compact(input.at) || Date.now()}`,
      pole: compact(input.pole) || "garden",
      label: compact(input.label),
      status: compact(input.status) || undefined,
      at: Number.isFinite(Number(input.at)) ? Number(input.at) : timestamp(input.createdAt),
    };
  }

  function addUnique(events, next) {
    if (!next?.label) return;
    if (events.some((item) => item.id === next.id || (item.pole === next.pole && item.label === next.label))) return;
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
        pole: "radar",
        status: "observation",
        label: `Nouvelle graine repérée · ${activeSeed.title || activeSeed.seedTitle || activeSeed.id}`,
        createdAt: activeSeed.updatedAt || activeSeed.createdAt,
      }));
    }

    if (runtimeState.loading) {
      addUnique(events, event({
        id: "garden:observing",
        pole: "observatoire",
        status: "observation",
        label: "Gérard observe · Actualisation du Garden",
        at: Date.now(),
      }));
    }

    if (runtimeRecord?.activity) {
      const status = compact(runtimeRecord.status);
      const isAttempt = ["queued", "running"].includes(status);
      const isBlocked = ["blocked", "failed"].includes(status);
      addUnique(events, event({
        id: `garden:${runtimeRecord.operationId || runtimeRecord.updatedAt || status}`,
        pole: isBlocked || isAttempt ? "octopus" : "observatoire",
        status: isBlocked ? "blocage" : isAttempt ? "experimentation" : "observation",
        label: `${isBlocked ? "Une épine bloque la sortie" : isAttempt ? "Une tentative est en cours" : "Gérard observe"} · ${runtimeRecord.activity}`,
        createdAt: runtimeRecord.updatedAt,
      }));
    }

    if (runtimeRecord?.harvest) {
      addUnique(events, event({
        id: `harvest:${runtimeRecord.harvest.id || runtimeRecord.operationId || runtimeRecord.updatedAt}`,
        pole: "garden",
        status: "recolte",
        label: `Une récolte revient au Garden · ${runtimeRecord.harvest.title || "Récolte disponible"}`,
        createdAt: runtimeRecord.updatedAt,
      }));
    }

    if (runtimeError) {
      addUnique(events, event({
        id: `thorn:${runtimeError}`,
        pole: "octopus",
        status: "blocage",
        label: `Une épine bloque la sortie · ${runtimeError}`,
        at: Date.now(),
      }));
    }

    if (draft?.id && draft.status !== "cancelled") {
      addUnique(events, event({
        id: `draft:${draft.id}`,
        pole: "publisher",
        status: "preparation",
        label: `Gérard prépare son sac · ${draft.objective || draft.curiosity?.title || draft.id}`,
        createdAt: draft.updatedAt || draft.createdAt,
      }));
      (draft.grafts || []).forEach((graft) => addUnique(events, event({
        id: `graft:${draft.id}:${graft}`,
        pole: "octopus",
        status: "reflexion",
        label: `Un greffon est consulté · ${graft}`,
        createdAt: draft.updatedAt || draft.createdAt,
      })));
    }

    bundles.slice(0, 3).forEach((bundle) => {
      if (bundle.failure) {
        addUnique(events, event({
          id: `failure:${bundle.id}`,
          pole: "octopus",
          status: "blocage",
          label: `Une épine bloque la sortie · ${bundle.failure.reason}`,
          createdAt: bundle.createdAt,
        }));
      }
      (bundle.harvests || []).forEach((harvest) => addUnique(events, event({
        id: `return-harvest:${harvest.id}`,
        pole: "garden",
        status: "recolte",
        label: `Une récolte revient au Garden · ${harvest.title}`,
        createdAt: harvest.createdAt || bundle.createdAt,
      })));
      (bundle.seeds || []).forEach((seed) => addUnique(events, event({
        id: `return-seed:${seed.id}`,
        pole: "radar",
        status: "observation",
        label: `Nouvelle graine repérée · ${seed.title}`,
        createdAt: seed.createdAt || bundle.createdAt,
      })));
    });

    return events.sort((left, right) => left.at - right.at).slice(-8);
  }

  function renderLinks(activeLink) {
    return LINKS.map(([a, b]) => {
      const pa = polePos(a);
      const pb = polePos(b);
      const key = linkKey(a, b);
      return `<line class="ae-link ${activeLink === key ? "is-active" : ""}" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" />`;
    }).join("");
  }

  function renderPoles(activePole) {
    return POLES.map((pole) => `<g class="ae-pole ${activePole === pole.id ? "is-active" : ""}" transform="translate(${pole.x} ${pole.y})" data-activity-pole="${esc(pole.id)}"><circle class="ae-pole-halo" r="14"></circle><circle class="ae-pole-ring" r="5"></circle><circle class="ae-pole-core" r="2.2"></circle><text class="ae-pole-label" y="-9" text-anchor="middle">${esc(pole.label)}</text></g>`).join("");
  }

  function render(events) {
    const items = Array.isArray(events) ? events : [];
    const lastEvent = items[items.length - 1];
    const previousEvent = items[items.length - 2];
    const status = lastEvent?.status || "calme";
    const currentPole = lastEvent?.pole || "garden";
    const pos = polePos(currentPole);
    const leftPct = (pos.x / 200) * 100;
    const topPct = (pos.y / 150) * 100;
    const activeLink = previousEvent ? linkKey(previousEvent.pole, currentPole) : null;
    const timeline = items.slice(-5).reverse();

    return `<section class="activity-echo ae-root" data-status="${esc(status)}" role="group" aria-label="Écho d'activité de Gérard"><div class="ae-sr" aria-live="polite">${esc(STATUS_LABEL[status] || STATUS_LABEL.calme)}</div><div class="ae-scene"><svg class="ae-svg" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="ae-pole-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"></stop><stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop></radialGradient></defs>${renderLinks(activeLink)}${renderPoles(currentPole)}</svg><div class="ae-creature-wrap" style="left:${leftPct}%;top:${topPct}%;" aria-hidden="true"><svg class="ae-creature" viewBox="-22 -22 44 44"><circle class="ae-creature-body" r="7"></circle><circle class="ae-creature-core" r="2.4"></circle><path class="ae-creature-tent" d="M -5 5 q -3 5 -8 6"></path><path class="ae-creature-tent" d="M  0 7 q  0 6  1 10"></path><path class="ae-creature-tent" d="M  5 5 q  4 5  8 5"></path></svg></div></div>${timeline.length === 0 ? `<div class="ae-veille">${esc(EMPTY_MESSAGE)}</div>` : `<ol class="ae-timeline" aria-label="Derniers événements">${timeline.map((item, index) => `<li class="ae-timeline-item" style="opacity:${1 - index * 0.18}" title="${esc(new Date(item.at).toLocaleTimeString())}"><strong>${esc(poleName(item.pole))}</strong><span>${esc(item.label)}</span>${index < timeline.length - 1 ? `<span class="ae-timeline-sep"> · </span>` : ""}</li>`).join("")}</ol>`}</section>`;
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

  global.ActivityEcho = { EMPTY_MESSAGE, POLES, LINKS, collectEvents, render, mount };

  if (typeof global.render === "function") {
    const baseRender = global.render;
    global.render = function renderWithActivityEcho() {
      baseRender();
      mount();
    };
    global.render();
  }
})(globalThis);
