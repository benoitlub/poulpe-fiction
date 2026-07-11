(function adventureLaunchModule(global) {
  "use strict";

  const RECEIPT_KEY = "poulpe-fiction:adventure-departure:v1";

  function listSection(title, items) {
    const values = Array.isArray(items) ? items : [];
    return [title, ...(values.length ? values.map((item) => `- ${item}`) : ["- aucun élément déclaré"])].join("\n");
  }

  function usesMistral(draft) {
    return [...(draft.picnic || []), ...(draft.grafts || [])]
      .some((item) => String(item).toLowerCase().includes("mistral"));
  }

  function activeParcelContext() {
    return global.BlacklaceParcel?.activeSeed?.() || null;
  }

  function toMissionPayload(draft) {
    if (!global.AdventureDraft?.isValid(draft)) {
      throw new Error("AdventureDraft invalide.");
    }
    if (draft.status !== "validated" || !draft.gardenerValidation?.validatedAt) {
      throw new Error("Seule une aventure explicitement validée peut partir.");
    }

    const title = draft.curiosity.title || draft.curiosity.id;
    const context = activeParcelContext();
    const prompt = [
      "Tu exécutes une aventure préparée dans Poulpe Fiction.",
      "Respecte strictement l'objectif, le sac, les limites et les ressources annoncées.",
      "N'invente aucune autorisation supplémentaire et ne contourne aucune limite.",
      "Produis un résultat exploitable et une trace claire de ce qui a été appris.",
      context ? `Parcelle: ${context.parcelName} (${context.parcelId})` : "",
      context ? `Seed source: ${context.seedTitle} (${context.seedId})` : "",
      context ? `Première récolte attendue: ${context.firstHarvest}` : "",
      "",
      `AdventureDraft: ${draft.id}`,
      `Curiosité: ${title}`,
      `Objectif: ${draft.objective}`,
      listSection("Sac:", draft.bag),
      listSection("Pique-nique annoncé:", draft.picnic),
      listSection("Greffons proposés:", draft.grafts),
      listSection("Limites:", draft.limits),
      `Validation du jardinier: ${draft.gardenerValidation.validatedAt}`,
      draft.gardenerValidation.note ? `Note du jardinier: ${draft.gardenerValidation.note}` : "",
      "",
      "Retour attendu: une Harvest, une trace, une question plus précise ou un apprentissage explicite."
    ].filter(Boolean).join("\n");

    return {
      parcelId: context?.parcelId || "poulpe-fiction",
      title: `Aventure · ${title}`,
      objective: draft.objective,
      prompt,
      authorize: usesMistral(draft) ? ["mistral"] : []
    };
  }

  function saveDepartureReceipt(receipt) {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
  }

  function processReturn(draft, result, errorMessage = "") {
    if (!global.AdventureReturnProcessor) return null;
    const status = String(result?.status || "");
    if (!errorMessage && status === "waiting-authorization") return null;
    return global.AdventureReturnProcessor.process(draft, result, errorMessage);
  }

  async function launchValidatedAdventure() {
    const draft = global.AdventureDraft.load();
    if (!draft || draft.status !== "validated") return;

    let payload;
    try {
      payload = toMissionPayload(draft);
    } catch (error) {
      state.apiError = error instanceof Error ? error.message : "Aventure invalide";
      render();
      return;
    }

    state.step = "mission";
    state.apiError = null;
    state.authorized = payload.authorize.includes("mistral");
    render();

    try {
      const response = await fetch(`${OCTOPUS_API}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || `Octopus ${response.status} ${response.statusText}`);
      }

      result.parcelId = result.parcelId || payload.parcelId;
      state.mission = result;
      state.step = "result";
      saveDepartureReceipt({
        version: 1,
        adventureDraftId: draft.id,
        parcelId: payload.parcelId,
        departedAt: new Date().toISOString(),
        missionId: result?.id || result?.missionId || null,
        missionStatus: result?.status || "unknown"
      });

      const bundle = processReturn(draft, result);
      if (bundle) {
        const count = bundle.harvests.length + bundle.seeds.length + bundle.questions.length + bundle.learnings.length;
        pushChat("gerard", bundle.failure
          ? `🧺 Je suis revenu de « ${draft.curiosity.title || draft.curiosity.id} », mais l'aventure n'a rien rapporté d'exploitable. J'ai gardé la trace du retour.`
          : `🧺 Je suis revenu de « ${draft.curiosity.title || draft.curiosity.id} » avec ${count} élément${count > 1 ? "s" : ""} à verser au jardin.`);
      } else {
        pushChat("gerard", `🚶 Je suis parti avec le sac validé pour « ${draft.curiosity.title || draft.curiosity.id} ». Octopus Engine a reçu exactement l'objectif, le pique-nique, les greffons et les limites annoncés.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue pendant le départ";
      state.apiError = message;
      state.step = "result";
      processReturn(draft, { status: "failed", summary: message, parcelId: payload.parcelId }, message);
      pushChat("gerard", `🧺 Je suis revenu sans récolte de « ${draft.curiosity.title || draft.curiosity.id} ». L'échec est conservé dans le journal de retour.`);
    }
    render();
  }

  global.AdventureLaunch = { RECEIPT_KEY, toMissionPayload, launch: launchValidatedAdventure };

  const renderDraft = renderAdventureUrge;
  renderAdventureUrge = function renderLaunchableAdventureDraft() {
    const html = renderDraft();
    const draft = global.AdventureDraft.load();
    if (!draft || draft.status !== "validated") return html;
    return html
      .replace("L'aventure est validée et attend son départ.", "L'aventure est validée. Le chemin vers Octopus est ouvert.")
      .replace(
        '<button class="primary" disabled title="Le branchement vers Octopus Engine arrive à l\'étape suivante">✅ Validée · Départ plus tard</button>',
        '<button class="primary" id="launchValidatedAdventure">🚶 Partir avec ce sac</button>'
      );
  };

  const bindDraftActions = bindGreenhouseActions;
  bindGreenhouseActions = function bindAdventureLaunchActions() {
    bindDraftActions();
    const launchButton = document.getElementById("launchValidatedAdventure");
    if (launchButton) launchButton.onclick = launchValidatedAdventure;
  };

  render();
})(globalThis);
