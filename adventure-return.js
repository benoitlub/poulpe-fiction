(function adventureReturnModule(global) {
  "use strict";

  const OUTBOX_KEY = "poulpe-fiction:garden-return-outbox:v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function textValue(value) {
    if (typeof value === "string") return value.trim();
    if (value === null || value === undefined) return "";
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function outputText(mission) {
    const output = asRecord(mission?.output);
    return textValue(output.text || output.content || output.result || mission?.summary || output);
  }

  function normalizeNamedItem(value, fallbackTitle) {
    if (typeof value === "string") {
      return { title: value.slice(0, 120) || fallbackTitle, description: value };
    }
    const record = asRecord(value);
    const description = textValue(record.description || record.content || record.details || record.summary || record.text || record);
    return {
      title: textValue(record.title || record.name || record.label || fallbackTitle).slice(0, 120),
      description,
      ...record
    };
  }

  function normalizeHarvest(value, context) {
    const item = normalizeNamedItem(value, context.title || "Récolte d'aventure");
    return {
      id: textValue(item.id) || id("harvest"),
      kind: "harvest",
      parcelId: context.parcelId,
      adventureDraftId: context.adventureDraftId,
      missionId: context.missionId,
      title: item.title,
      description: item.description,
      artifactType: textValue(item.artifactType || item.type || "text"),
      artifact: item.artifact ?? item.content ?? item.description,
      createdAt: nowIso()
    };
  }

  function normalizeSeed(value, context) {
    const item = normalizeNamedItem(value, "Nouvelle piste");
    return {
      id: textValue(item.id) || id("seed"),
      kind: "seed",
      parcelId: context.parcelId,
      sourceAdventureDraftId: context.adventureDraftId,
      sourceMissionId: context.missionId,
      title: item.title,
      description: item.description,
      createdAt: nowIso()
    };
  }

  function normalizeQuestion(value, context) {
    const item = normalizeNamedItem(value, "Décision nécessaire");
    return {
      id: textValue(item.id) || id("question"),
      kind: "question",
      parcelId: context.parcelId,
      sourceAdventureDraftId: context.adventureDraftId,
      sourceMissionId: context.missionId,
      title: item.title,
      context: item.description,
      choices: asArray(item.choices).map(textValue).filter(Boolean),
      createdAt: nowIso()
    };
  }

  function normalizeLearning(value, context) {
    const item = normalizeNamedItem(value, "Apprentissage");
    return {
      id: textValue(item.id) || id("learning"),
      kind: "learning",
      parcelId: context.parcelId,
      sourceAdventureDraftId: context.adventureDraftId,
      sourceMissionId: context.missionId,
      summary: item.title,
      details: item.description,
      confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : null,
      createdAt: nowIso()
    };
  }

  function loadOutbox() {
    try {
      const value = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function saveBundle(bundle) {
    const previous = loadOutbox().filter((item) => item.id !== bundle.id);
    const next = [bundle, ...previous].slice(0, 50);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    return bundle;
  }

  function process(draft, mission, errorMessage = "") {
    if (!draft?.id) throw new Error("AdventureReturnProcessor requires an AdventureDraft.");

    const output = asRecord(mission?.output);
    const missionId = textValue(mission?.id || mission?.missionId) || null;
    const status = textValue(mission?.status || (errorMessage ? "failed" : "unknown"));
    const context = {
      parcelId: textValue(mission?.parcelId) || "poulpe-fiction",
      adventureDraftId: draft.id,
      missionId,
      title: `Retour · ${draft.curiosity?.title || draft.curiosity?.id || "aventure"}`
    };

    const failed = Boolean(errorMessage) || ["failed", "error", "cancelled"].includes(status);
    const harvestCandidates = asArray(output.harvests || output.artifacts || output.deliverables);
    const seedCandidates = asArray(output.seeds || output.opportunities || output.nextIdeas);
    const questionCandidates = asArray(output.questions || output.decisionsRequired);
    const learningCandidates = asArray(output.learnings || output.insights || output.lessons);

    const harvests = harvestCandidates.map((item) => normalizeHarvest(item, context));
    if (!failed && harvests.length === 0) {
      const fallback = outputText(mission);
      if (fallback) harvests.push(normalizeHarvest({ title: context.title, description: fallback, artifact: mission?.output || fallback }, context));
    }

    const bundle = {
      version: 1,
      id: `return_${draft.id}_${missionId || Date.now()}`,
      status: failed ? "failed" : "ready",
      deliveryStatus: "pending-adapter",
      parcelId: context.parcelId,
      adventureDraftId: draft.id,
      missionId,
      createdAt: nowIso(),
      harvests,
      seeds: seedCandidates.map((item) => normalizeSeed(item, context)),
      questions: questionCandidates.map((item) => normalizeQuestion(item, context)),
      learnings: learningCandidates.map((item) => normalizeLearning(item, context)),
      failure: failed ? {
        id: id("failure"),
        kind: "failure",
        reason: errorMessage || textValue(mission?.summary || output.policyReason || "L'aventure n'a pas produit de résultat exploitable."),
        details: outputText(mission),
        createdAt: nowIso()
      } : null,
      rawMission: mission || null
    };

    return saveBundle(bundle);
  }

  function latestForDraft(draftId) {
    return loadOutbox().find((bundle) => bundle.adventureDraftId === draftId) || null;
  }

  function renderBundle(bundle) {
    if (!bundle) return "";
    const sections = [
      ["🌾 Récoltes", bundle.harvests, (item) => item.title],
      ["🌱 Nouvelles pistes", bundle.seeds, (item) => item.title],
      ["❓ Questions", bundle.questions, (item) => item.title],
      ["🧠 Apprentissages", bundle.learnings, (item) => item.summary]
    ].filter(([, items]) => items?.length);

    const failure = bundle.failure
      ? `<article class="plan-item"><strong>💀 Retour sans récolte</strong><p>${esc(bundle.failure.reason)}</p></article>`
      : "";
    const cards = sections.map(([title, items, label]) => `<article class="plan-item"><strong>${title}</strong><ul>${items.map((item) => `<li>${esc(label(item))}</li>`).join("")}</ul></article>`).join("");
    const count = (bundle.harvests?.length || 0) + (bundle.seeds?.length || 0) + (bundle.questions?.length || 0) + (bundle.learnings?.length || 0);

    return `<section class="adventure-return"><p class="eyebrow">Retour d'aventure · ${esc(bundle.status)}</p><h2>${bundle.failure ? "Gérard est revenu les tentacules presque vides." : `Gérard a rapporté ${count} élément${count > 1 ? "s" : ""}.`}</h2><div class="plans">${cards}${failure}</div><small>Retour conservé dans l'outbox Poulpe Fiction · livraison Garden : ${esc(bundle.deliveryStatus)}</small></section>`;
  }

  global.AdventureReturnProcessor = { OUTBOX_KEY, process, loadOutbox, latestForDraft, renderBundle };

  const baseRender = render;
  render = function renderWithAdventureReturn() {
    baseRender();
    if (state.step !== "result") return;
    const draft = global.AdventureDraft?.load?.();
    const bundle = draft ? latestForDraft(draft.id) : null;
    if (!bundle) return;
    const panel = root.querySelector(".panel");
    if (panel && !panel.querySelector(".adventure-return")) panel.insertAdjacentHTML("beforeend", renderBundle(bundle));
  };
})(globalThis);
