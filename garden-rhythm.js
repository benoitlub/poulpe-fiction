(function gardenRhythmModule(global) {
  "use strict";

  const WORK_KEY = "poulpe-fiction:garden-work:v1";
  const MAX_WAIT_MS = 90000;
  let working = false;

  function nowIso() { return new Date().toISOString(); }
  function loadWork() {
    try { return JSON.parse(localStorage.getItem(WORK_KEY) || "null"); }
    catch (_) { return null; }
  }
  function saveWork(value) {
    localStorage.setItem(WORK_KEY, JSON.stringify(value));
    return value;
  }
  function activeContext() { return global.BlacklaceParcel?.activeSeed?.() || null; }
  function seedDefinition(seedId) { return global.BlacklaceParcel?.parcel?.seeds?.find((seed) => seed.id === seedId) || null; }

  function workLabel(status) {
    return ({
      observing: "Gérard observe la parcelle",
      preparing: "Gérard rassemble ce dont il a besoin",
      growing: "Gérard travaille en arrière-plan",
      ready: "Une récolte est prête à être examinée",
      paused: "Le travail reprendra au prochain passage",
      blocked: "Une information manque avant de continuer"
    })[status] || "Gérard veille sur la parcelle";
  }

  function renderWorkCard() {
    const context = activeContext();
    if (!context) return "";
    const work = loadWork();
    const draft = global.AdventureDraft?.load?.();
    const bundle = draft ? global.AdventureReturnProcessor?.latestForDraft?.(draft.id) : null;
    const pack = bundle ? global.ProductionPack?.createFromReturn?.(bundle) : null;
    const status = pack ? "ready" : work?.seedId === context.seedId ? work.status : "observing";
    const detail = pack
      ? "Gérard a fait pousser une première récolte. Tu peux l’ouvrir, la télécharger ou décider de la suite."
      : status === "growing"
        ? "Tu peux quitter cette page. Le travail continue sans bloquer l’interface."
        : status === "blocked"
          ? (work?.message || "Gérard a besoin d’une source fiable avant de continuer.")
          : status === "paused"
            ? "La tentative a pris trop longtemps. Rien n’est perdu et l’interface reste disponible."
            : "La parcelle est présente : Gérard s’y intéresse automatiquement, sans te demander de préparer son sac à sa place.";
    return `<section class="garden-work"><p class="eyebrow">🌱 Parcelle active · ${esc(context.seedTitle || context.seedId)}</p><h2>${esc(workLabel(status))}</h2><p>${esc(detail)}</p>${pack ? global.ProductionPack.render?.(pack) || "" : ""}</section>`;
  }

  async function ensureDraft(context) {
    let draft = global.AdventureDraft?.load?.();
    if (!draft || draft.curiosity?.id !== context.seedId) {
      saveWork({ seedId: context.seedId, status: "preparing", updatedAt: nowIso() });
      await global.BlacklaceParcel?.prepareSeedAdventure?.(context.seedId);
      draft = global.AdventureDraft?.load?.();
    }
    if (draft?.status === "prepared") {
      draft = global.AdventureDraft.validate(draft, "Travail interne autorisé automatiquement. Toute publication ou prise de contact reste soumise à validation humaine.");
      state.adventureUrge = draft;
    }
    return draft;
  }

  async function cultivate() {
    if (working) return;
    const context = activeContext();
    if (!context || !global.AdventureLaunch?.toMissionPayload) return;

    const current = loadWork();
    const draftNow = global.AdventureDraft?.load?.();
    const existingBundle = draftNow ? global.AdventureReturnProcessor?.latestForDraft?.(draftNow.id) : null;
    if (existingBundle?.status === "ready") {
      global.ProductionPack?.createFromReturn?.(existingBundle);
      saveWork({ seedId: context.seedId, status: "ready", updatedAt: nowIso() });
      render();
      return;
    }
    if (current?.seedId === context.seedId && current.status === "growing" && Date.now() - Date.parse(current.updatedAt || 0) < MAX_WAIT_MS) return;

    working = true;
    try {
      const draft = await ensureDraft(context);
      if (!draft || draft.status !== "validated") throw new Error("La parcelle n’a pas encore de dossier de travail valide.");
      saveWork({ seedId: context.seedId, draftId: draft.id, status: "growing", updatedAt: nowIso() });
      state.step = "objective";
      render();

      const payload = await global.AdventureLaunch.toMissionPayload(draft);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MAX_WAIT_MS);
      let result;
      try {
        const response = await fetch(`${OCTOPUS_API}/mission`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        result = await response.json();
        if (!response.ok) throw new Error(result?.message || `Le moteur n’a pas répondu correctement (${response.status}).`);
      } finally {
        clearTimeout(timer);
      }

      result.parcelId = result.parcelId || payload.parcelId;
      if (String(result.status || "") === "waiting-authorization") {
        throw new Error("Une autorisation interne attendue n’a pas été reconnue. Gérard garde le travail en attente sans bloquer l’écran.");
      }
      const bundle = global.AdventureReturnProcessor.process(draft, result);
      const pack = global.ProductionPack?.createFromReturn?.(bundle);
      saveWork({ seedId: context.seedId, draftId: draft.id, status: pack ? "ready" : bundle.status === "incomplete" ? "blocked" : "paused", message: bundle.status === "incomplete" ? "Le livrable est incomplet et doit être repris automatiquement." : "", updatedAt: nowIso() });
      pushChat("gerard", pack
        ? `🌾 J’ai fait pousser une première récolte pour « ${context.seedTitle} ». Elle est visible sans que tu aies à relancer la mission.`
        : `🌱 J’ai travaillé sur « ${context.seedTitle} », mais la récolte n’est pas encore assez mûre pour être exposée.`);
    } catch (error) {
      const timeout = error?.name === "AbortError";
      const message = timeout ? "Le travail a dépassé le temps d’attente de cette visite. Gérard reprendra sans bloquer l’écran." : (error instanceof Error ? error.message : "Le travail a rencontré un obstacle.");
      saveWork({ seedId: context.seedId, status: timeout ? "paused" : "blocked", message, updatedAt: nowIso() });
      pushChat("gerard", `🌱 Je garde « ${context.seedTitle} » au jardin. ${message}`);
    } finally {
      working = false;
      state.step = "objective";
      render();
    }
  }

  renderStatus = function renderGardenStatus() {
    const context = activeContext();
    return `<p class="eyebrow">Poulpe Fiction${context ? ` · ${esc(context.seedTitle)}` : " · jardin en observation"}</p>`;
  };

  const baseRenderAdventure = renderAdventureUrge;
  renderAdventureUrge = function renderPassiveGardenRhythm() {
    const context = activeContext();
    if (!context) return baseRenderAdventure();
    return renderWorkCard();
  };

  const baseRender = render;
  render = function renderWithoutEngineFunnel() {
    if (["mission", "analysis", "plan", "dialogue", "result"].includes(state.step)) state.step = "objective";
    baseRender();
    const brandEyebrow = document.querySelector(".brand .eyebrow");
    const brandTitle = document.querySelector(".brand h1");
    if (brandEyebrow) brandEyebrow.textContent = "Poulpe Fiction · fenêtre sur le jardin";
    if (brandTitle) brandTitle.textContent = activeContext() ? "Gérard cultive la parcelle" : "Que voulez-vous faire pousser ?";
    document.querySelectorAll(".adventures-label, .grid").forEach((element) => {
      if (element.classList.contains("grid") && !element.closest(".card")?.querySelector(".adventures-label")) return;
      element.style.display = activeContext() ? "none" : "";
    });
    global.ProductionPack?.bind?.();
  };

  global.GardenRhythm = { WORK_KEY, cultivate, renderWorkCard };
  render();
  setTimeout(() => void cultivate(), 800);
  setInterval(() => void cultivate(), 30000);
})(globalThis);
