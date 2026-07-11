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

  function toMissionPayload(draft) {
    if (!global.AdventureDraft?.isValid(draft)) {
      throw new Error("AdventureDraft invalide.");
    }
    if (draft.status !== "validated" || !draft.gardenerValidation?.validatedAt) {
      throw new Error("Seule une aventure explicitement validée peut partir.");
    }

    const title = draft.curiosity.title || draft.curiosity.id;
    const prompt = [
      "Tu exécutes une aventure préparée dans Poulpe Fiction.",
      "Respecte strictement l'objectif, le sac, les limites et les ressources annoncées.",
      "N'invente aucune autorisation supplémentaire et ne contourne aucune limite.",
      "Produis un résultat exploitable et une trace claire de ce qui a été appris.",
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
      parcelId: "poulpe-fiction",
      title: `Aventure · ${title}`,
      objective: draft.objective,
      prompt,
      authorize: usesMistral(draft) ? ["mistral"] : []
    };
  }

  function saveDepartureReceipt(receipt) {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
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

      state.mission = result;
      state.step = "result";
      saveDepartureReceipt({
        version: 1,
        adventureDraftId: draft.id,
        departedAt: new Date().toISOString(),
        missionId: result?.id || result?.missionId || null,
        missionStatus: result?.status || "unknown"
      });
      pushChat("gerard", `🚶 Je suis parti avec le sac validé pour « ${draft.curiosity.title || draft.curiosity.id} ». Octopus Engine a reçu exactement l'objectif, le pique-nique, les greffons et les limites annoncés.`);
    } catch (error) {
      state.apiError = error instanceof Error ? error.message : "Erreur inconnue pendant le départ";
      state.step = "result";
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
