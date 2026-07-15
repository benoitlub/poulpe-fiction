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
    observation: "Gérard explore la serre.",
    reflexion: "Gérard compare ce qu'il peut emporter.",
    preparation: "Gérard prépare son sac.",
    experimentation: "L'aventure est en cours.",
    recolte: "Une récolte est disponible.",
    blocage: "Gérard contourne une épine.",
    reussite: "Gérard revient avec une récolte.",
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
      title: compact(input.title),
      detail: compact(input.detail),
      status: compact(input.status) || undefined,
      technical: Boolean(input.technical),
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
        title: "👀 Gérard explore la serre",
        detail: "Une Seed attire son attention. Il cherche ce qui peut devenir une vraie récolte.",
        createdAt: activeSeed.updatedAt || activeSeed.createdAt,
      }));
    }

    if (runtimeState.loading) {
      addUnique(events, event({
        id: "garden:observing",
        pole: "observatoire",
        status: "observation",
        label: "Gérard observe · Actualisation du Garden",
        title: "👀 Gérard observe le Garden",
        detail: "Le hublot se met à jour avec l'activité déjà présente.",
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
        title: isBlocked ? "🌵 Gérard contourne une épine" : runtimeTitle(runtimeRecord.activity),
        detail: isBlocked
          ? "Le service distant répond mal ou demande une validation. Le Garden reste lisible."
          : runtimeDetail(runtimeRecord.activity),
        technical: true,
        createdAt: runtimeRecord.updatedAt,
      }));
    }

    if (runtimeRecord?.harvest) {
      addUnique(events, event({
        id: `harvest:${runtimeRecord.harvest.id || runtimeRecord.operationId || runtimeRecord.updatedAt}`,
        pole: "garden",
        status: "recolte",
        label: `Une récolte revient au Garden · ${runtimeRecord.harvest.title || "Récolte disponible"}`,
        title: "🌾 Récolte disponible",
        detail: "Une nouvelle récolte peut être examinée dans le Garden.",
        createdAt: runtimeRecord.updatedAt,
      }));
    }

    if (runtimeError) {
      addUnique(events, event({
        id: `thorn:${runtimeError}`,
        pole: "octopus",
        status: "blocage",
        label: `Une épine bloque la sortie · ${runtimeError}`,
        title: "🌵 Gérard contourne une épine",
        detail: "Le service distant répond lentement. Il poursuit avec les ressources disponibles.",
        technical: true,
        at: Date.now(),
      }));
    }

    if (draft?.id && draft.status !== "cancelled") {
      addUnique(events, event({
        id: `draft:${draft.id}`,
        pole: "publisher",
        status: "preparation",
        label: `Gérard prépare son sac · ${draft.objective || draft.curiosity?.title || draft.id}`,
        title: "🎒 Gérard prépare son sac",
        detail: "Les connaissances utiles sont sélectionnées avant le départ.",
        createdAt: draft.updatedAt || draft.createdAt,
      }));
      (draft.grafts || []).forEach((graft) => addUnique(events, event({
        id: `graft:${draft.id}:${graft}`,
        pole: "octopus",
        status: "reflexion",
        label: `Un greffon est consulté · ${graft}`,
        title: "🔧 Publisher prépare les producteurs",
        detail: "Les outils utiles sont comparés sans quitter le parcours Garden.",
        technical: true,
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
          title: "🌵 Gérard contourne une épine",
          detail: "Le retour signale un obstacle. Rien n'est publié automatiquement.",
          technical: true,
          createdAt: bundle.createdAt,
        }));
      }
      (bundle.harvests || []).forEach((harvest) => addUnique(events, event({
        id: `return-harvest:${harvest.id}`,
        pole: "garden",
        status: "recolte",
        label: `Une récolte revient au Garden · ${harvest.title}`,
        title: "🌾 Récolte disponible",
        detail: "Une nouvelle récolte revient dans le Garden.",
        createdAt: harvest.createdAt || bundle.createdAt,
      })));
      (bundle.seeds || []).forEach((seed) => addUnique(events, event({
        id: `return-seed:${seed.id}`,
        pole: "radar",
        status: "observation",
        label: `Nouvelle graine repérée · ${seed.title}`,
        title: "👀 Gérard explore la serre",
        detail: "Une nouvelle piste apparaît après le retour d'aventure.",
        createdAt: seed.createdAt || bundle.createdAt,
      })));
    });

    return events.sort((left, right) => left.at - right.at).slice(-8);
  }

  function runtimeTitle(activity) {
    const text = compact(activity).toLowerCase();
    if (text.includes("mistral")) return "✍️ Mistral rédige";
    if (text.includes("publisher")) return "🔧 Publisher prépare les producteurs";
    return "🎒 Gérard prépare son départ";
  }

  function runtimeDetail(activity) {
    const text = compact(activity).toLowerCase();
    if (text.includes("mistral")) return "La première récolte est en préparation.";
    if (text.includes("publisher")) return "Les producteurs disponibles sont consultés.";
    return "L'aventure avance avec les ressources autorisées.";
  }

  function isTechnical(item) {
    const text = `${item.pole || ""} ${item.label || ""}`.toLowerCase();
    return item.technical || /publisher|octopus|mistral|composio|postgresql/.test(text);
  }

  function missionProgress(items) {
    const text = items.map((item) => `${item.id} ${item.pole} ${item.status} ${item.label}`).join(" ").toLowerCase();
    const hasHarvest = /harvest|récolte|recolte/.test(text);
    const hasRunning = /running|tentative|experimentation|octopus|publisher|mistral/.test(text);
    const steps = [
      { id: "seed", label: "Seed", state: /seed|graine|radar/.test(text) ? "done" : "todo" },
      { id: "bag", label: "Sac", state: /draft|sac|preparation/.test(text) ? "done" : "todo" },
      { id: "departure", label: "Départ", state: hasRunning || hasHarvest ? "done" : "todo" },
      { id: "publisher", label: "Publisher", state: /publisher|graft|greffon/.test(text) || hasHarvest ? "done" : "todo" },
      { id: "mistral", label: "Mistral", state: /mistral/.test(text) || hasHarvest ? "done" : hasRunning ? "active" : "todo" },
      { id: "harvest", label: "Récolte", state: hasHarvest ? "done" : "todo" },
    ];
    return { steps, percent: Math.round((steps.filter((step) => step.state === "done").length / steps.length) * 100) };
  }

  function renderProgress(items) {
    const progress = missionProgress(items);
    return `<div class="ae-progress" aria-label="Progression de mission"><div class="ae-progress-head"><span>Progression</span><strong>Seed</strong></div><div class="ae-progress-bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></div><ol>${progress.steps.map((step) => `<li class="ae-step ae-step-${esc(step.state)}"><span>${step.state === "done" ? "✔" : step.state === "active" ? "⏳" : "○"}</span>${esc(step.label)}</li>`).join("")}</ol></div>`;
  }

  function renderTimelineItem(item, index) {
    const title = item.title || poleName(item.pole);
    const detail = item.detail || item.label;
    return `<li class="ae-timeline-item ae-card" style="opacity:${1 - index * 0.12}" title="${esc(new Date(item.at).toLocaleTimeString())}"><strong>${esc(title)}</strong><span>${esc(detail)}</span></li>`;
  }

  function renderTechnicalDetails(items) {
    const technical = items.filter(isTechnical);
    if (!technical.length) return "";
    return `<details class="ae-debug"><summary>Détails techniques</summary><ul>${technical.map((item) => `<li><strong>${esc(poleName(item.pole))}</strong><span>${esc(item.label)}</span></li>`).join("")}</ul></details>`;
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

    return `<section class="activity-echo ae-root" data-status="${esc(status)}" role="group" aria-label="Carnet d'aventure de Gérard"><div class="ae-sr" aria-live="polite">${esc(STATUS_LABEL[status] || STATUS_LABEL.calme)}</div><div class="ae-scene"><svg class="ae-svg" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="ae-pole-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"></stop><stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop></radialGradient></defs>${renderLinks(activeLink)}${renderPoles(currentPole)}</svg><div class="ae-creature-wrap" style="left:${leftPct}%;top:${topPct}%;" aria-hidden="true"><svg class="ae-creature" viewBox="-22 -22 44 44"><circle class="ae-creature-body" r="7"></circle><circle class="ae-creature-core" r="2.4"></circle><path class="ae-creature-tent" d="M -5 5 q -3 5 -8 6"></path><path class="ae-creature-tent" d="M  0 7 q  0 6  1 10"></path><path class="ae-creature-tent" d="M  5 5 q  4 5  8 5"></path></svg></div></div>${renderProgress(items)}${timeline.length === 0 ? `<div class="ae-veille">${esc(EMPTY_MESSAGE)}</div>` : `<ol class="ae-timeline" aria-label="Carnet d'aventure">${timeline.map(renderTimelineItem).join("")}</ol>`}${renderTechnicalDetails(timeline)}</section>`;
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
