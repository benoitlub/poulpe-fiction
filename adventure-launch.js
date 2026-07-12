(function adventureLaunchModule(global) {
  "use strict";

  const RECEIPT_KEY = "poulpe-fiction:adventure-departure:v1";
  const COMPLETE_MARKER = "<!-- HARVEST_COMPLETE -->";

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

  async function verifiedKnowledge(context) {
    if (!context?.seedId) return null;
    return global.PublisherKnowledge?.load?.(context.seedId)
      || global.ProductKnowledge?.get?.(context.seedId)
      || null;
  }

  function knowledgePromptFor(knowledge) {
    if (!knowledge) return "";
    if (typeof knowledge.prompt === "string") return knowledge.prompt;
    return global.ProductKnowledge?.toPrompt?.(knowledge) || "";
  }

  function deliverableContract(context) {
    if (context?.seedId === "terra") {
      return [
        "LIVRABLE UNIQUE DE CETTE AVENTURE:",
        "Rédige une page de présentation complète et directement publiable pour TERRA.",
        "Elle doit contenir: titre, accroche, résumé fidèle, 3 raisons de lire, public formulé comme hypothèse, section auteur, CTA Amazon avec [LIEN AMAZON À AJOUTER], et 3 métadonnées SEO.",
        "Ne produis ni calendrier éditorial, ni liste de médias, ni rapport de positionnement séparé dans cette mission.",
        "N'invente aucun extrait, aucune critique, aucun compte social, aucun partenaire et aucune comparaison promotionnelle.",
        "Le texte final doit pouvoir être copié-collé tel quel après ajout du lien Amazon."
      ].join("\n");
    }
    if (context?.seedId === "gerard-et-gerard") {
      return [
        "LIVRABLE UNIQUE DE CETTE AVENTURE:",
        "Rédige une page de présentation complète et directement publiable pour Gérard & Gérard.",
        "Elle doit contenir: titre, accroche, résumé fidèle, promesse de lecture, 3 raisons de lire, section auteur, CTA Amazon avec [LIEN AMAZON À AJOUTER], et 3 métadonnées SEO.",
        "Ne produis ni calendrier éditorial ni campagne sociale dans cette mission.",
        "Le texte final doit pouvoir être copié-collé tel quel après ajout du lien Amazon."
      ].join("\n");
    }
    return [
      "LIVRABLE UNIQUE DE CETTE AVENTURE:",
      `Produis un seul livrable principal complet correspondant à: ${context?.firstHarvest || "la première récolte attendue"}.`,
      "Ne remplace pas le livrable par une stratégie, un plan, des conseils ou une liste de choses à faire.",
      "Le résultat doit être directement utilisable après validation humaine."
    ].join("\n");
  }

  async function toMissionPayload(draft) {
    if (!global.AdventureDraft?.isValid(draft)) throw new Error("AdventureDraft invalide.");
    if (draft.status !== "validated" || !draft.gardenerValidation?.validatedAt) throw new Error("Seule une aventure explicitement validée peut partir.");

    const title = draft.curiosity.title || draft.curiosity.id;
    const gardenContext = activeParcelContext();
    const knowledge = await verifiedKnowledge(gardenContext);
    if (gardenContext?.parcelId === "blacklace-ecosystem" && !knowledge?.verified) {
      throw new Error(`Knowledge Pack Publisher vérifié manquant pour « ${gardenContext.seedTitle || title} ». Gérard refuse d'inventer.`);
    }

    const knowledgePrompt = knowledgePromptFor(knowledge);
    const prompt = [
      "Tu exécutes une aventure préparée dans Poulpe Fiction.",
      "Respecte strictement l'objectif, le sac, les limites, les ressources annoncées et le dossier produit vérifié.",
      "N'invente aucune autorisation, preuve, caractéristique, promesse commerciale, chiffre, témoignage, urgence ou réduction.",
      "Si une information nécessaire manque, produis une question explicite au lieu de la fabriquer.",
      gardenContext ? `Parcelle: ${gardenContext.parcelName} (${gardenContext.parcelId})` : "",
      gardenContext ? `Seed source: ${gardenContext.seedTitle} (${gardenContext.seedId})` : "",
      gardenContext ? `Première récolte attendue: ${gardenContext.firstHarvest}` : "",
      knowledge ? `Source de connaissance: ${knowledge.source || "inconnue"}` : "",
      knowledgePrompt,
      deliverableContract(gardenContext),
      "RÈGLES DE COMPLÉTUDE:",
      "- Un seul livrable principal, entièrement rédigé.",
      "- Pas de placeholders sauf [LIEN AMAZON À AJOUTER] lorsqu'un lien vérifié manque.",
      "- Pas de section commencée puis abandonnée.",
      "- Termine obligatoirement la toute dernière ligne par le marqueur exact suivant:",
      COMPLETE_MARKER,
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
      "Retour attendu: le livrable final complet, puis le marqueur de complétude."
    ].filter(Boolean).join("\n");

    const contextId = gardenContext?.parcelId || "poulpe-fiction";
    return {
      operationId: `adventure_${draft.id}`,
      title: `Aventure · ${title}`,
      objective: draft.objective,
      context: {
        id: contextId,
        label: gardenContext?.parcelName || "Poulpe Fiction",
        objective: gardenContext?.objective || draft.objective,
        metadata: {
          owner: "poulpe-fiction",
          adventureDraftId: draft.id,
          seedId: gardenContext?.seedId || null,
          seedTitle: gardenContext?.seedTitle || null,
          expectedHarvest: gardenContext?.firstHarvest || null
        }
      },
      requiredCapabilities: ["campaign.generate"],
      authorizationPolicy: {
        internalWork: "allowed",
        externalAction: "requires-human-approval"
      },
      prompt,
      authorizedResources: usesMistral(draft) ? ["mistral"] : [],
      authorize: usesMistral(draft) ? ["mistral"] : [],
      parcelId: contextId
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
      state.step = "mission";
      state.apiError = null;
      render();
      payload = await toMissionPayload(draft);
    } catch (error) {
      state.apiError = error instanceof Error ? error.message : "Aventure invalide";
      state.step = "result";
      render();
      return;
    }

    state.authorized = payload.authorizedResources.includes("mistral");
    render();

    try {
      const response = await fetch(`${OCTOPUS_API}/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || `Octopus ${response.status} ${response.statusText}`);

      result.contextId = result.contextId || payload.context.id;
      result.parcelId = result.parcelId || result.contextId;
      result.operationId = result.operationId || result.missionId || payload.operationId;
      state.mission = result;
      state.step = "result";
      saveDepartureReceipt({
        version: 2,
        adventureDraftId: draft.id,
        contextId: payload.context.id,
        parcelId: payload.context.id,
        departedAt: new Date().toISOString(),
        operationId: result.operationId,
        missionId: result?.missionId || result?.id || null,
        missionStatus: result?.status || "unknown"
      });

      const bundle = processReturn(draft, result);
      if (bundle) {
        const count = bundle.harvests.length + bundle.seeds.length + bundle.questions.length + bundle.learnings.length;
        pushChat("gerard", bundle.status === "incomplete"
          ? `✂️ Je suis revenu de « ${draft.curiosity.title || draft.curiosity.id} », mais le livrable a été coupé. Je ne le compte pas comme récolte.`
          : bundle.failure
            ? `🧺 Je suis revenu de « ${draft.curiosity.title || draft.curiosity.id} », mais l'aventure n'a rien rapporté d'exploitable. J'ai gardé la trace du retour.`
            : `🧺 Je suis revenu de « ${draft.curiosity.title || draft.curiosity.id} » avec ${count} élément${count > 1 ? "s" : ""} à verser au jardin.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue pendant le départ";
      state.apiError = message;
      state.step = "result";
      processReturn(draft, { status: "failed", summary: message, contextId: payload.context.id, parcelId: payload.context.id, operationId: payload.operationId }, message);
      pushChat("gerard", `🧺 Je suis revenu sans récolte de « ${draft.curiosity.title || draft.curiosity.id} ». L'échec est conservé dans le journal de retour.`);
    }
    render();
  }

  global.AdventureLaunch = { RECEIPT_KEY, COMPLETE_MARKER, toMissionPayload, launch: launchValidatedAdventure };

  const renderDraft = renderAdventureUrge;
  renderAdventureUrge = function renderLaunchableAdventureDraft() {
    const html = renderDraft();
    const draft = global.AdventureDraft.load();
    if (!draft || draft.status !== "validated") return html;
    return html
      .replace("L'aventure est validée et attend son départ.", "L'aventure est validée. Le chemin vers Octopus est ouvert.")
      .replace('<button class="primary" disabled title="Le branchement vers Octopus Engine arrive à l\'étape suivante">✅ Validée · Départ plus tard</button>', '<button class="primary" id="launchValidatedAdventure">🚶 Partir avec ce sac</button>');
  };

  const bindDraftActions = bindGreenhouseActions;
  bindGreenhouseActions = function bindAdventureLaunchActions() {
    bindDraftActions();
    const launchButton = document.getElementById("launchValidatedAdventure");
    if (launchButton) launchButton.onclick = launchValidatedAdventure;
  };

  render();
})(globalThis);
