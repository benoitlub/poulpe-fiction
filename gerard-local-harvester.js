(function gerardLocalHarvesterModule(global) {
  "use strict";

  const STATE_KEY = "poulpe-fiction:gerard-local-harvester:v1";
  const now = () => new Date().toISOString();
  const text = (value) => typeof value === "string" ? value.trim() : "";

  function snapshot() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function save(patch) {
    const next = { ...snapshot(), ...patch, updatedAt: now() };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function activeSeed(draft) {
    const data = global.GardenStore?.snapshot?.() || { seeds: [], parcels: [] };
    const seed = (data.seeds || []).find((item) => item.id === draft?.curiosity?.id) || null;
    const parcel = (data.parcels || []).find((item) => item.id === (seed?.parcelId || draft?.curiosity?.parcelId)) || null;
    return { seed, parcel };
  }

  function productPack(seed, parcel) {
    const slug = text(seed?.knowledgeSlug) || text(parcel?.knowledgeSlug) || text(seed?.id);
    return global.ProductKnowledge?.get?.(slug) || global.ProductKnowledge?.get?.(seed?.id) || null;
  }

  function harvestText(seed, parcel, pack) {
    const objective = text(seed?.objective || seed?.content);
    if (pack) {
      const angles = Array.isArray(pack.sampleAngles) ? pack.sampleAngles.slice(0, 3) : [];
      const audiences = Array.isArray(pack.audienceHypotheses) ? pack.audienceHypotheses.slice(0, 3) : [];
      return [
        `# Récolte locale · ${pack.title || seed.title}`,
        "",
        `## Ce que Gérard a appris`,
        `Le noyau commercial le plus fidèle est : ${pack.campaignDirection || pack.synopsis || objective}`,
        "",
        `## Publics à tester`,
        ...audiences.map((item) => `- ${item}`),
        "",
        `## Trois angles immédiatement exploitables`,
        ...angles.map((item, index) => `${index + 1}. ${item}`),
        "",
        `## Prochaine action interne`,
        `Préparer une publication courte à partir de l’angle 1, sans inventer de preuve sociale, de chiffre ou d’urgence.`,
      ].join("\n");
    }

    return [
      `# Récolte locale · ${seed?.title || "Graine"}`,
      "",
      `## Observation`,
      objective || `Gérard a inspecté la graine « ${seed?.title || seed?.id} » dans ${parcel?.name || seed?.parcelId || "la parcelle"}.`,
      "",
      `## Apprentissage`,
      `La graine manque encore d’un Knowledge Pack vérifié. Elle reste néanmoins enregistrée, visible et prête à être enrichie sans bloquer le Garden.`,
      "",
      `## Prochaine action interne`,
      `Rassembler les faits vérifiés disponibles dans la parcelle, puis proposer un premier livrable limité à ces faits.`,
    ].join("\n");
  }

  async function harvest(draft, reason = "local-first") {
    if (!draft?.id || !global.AdventureReturnProcessor?.process) {
      throw new Error("Le processeur de récolte locale n’est pas prêt.");
    }

    const { seed, parcel } = activeSeed(draft);
    if (!seed) throw new Error("Aucune graine active à récolter.");

    const existing = global.AdventureReturnProcessor.latestForDraft?.(draft.id);
    if (existing?.status === "ready" && existing?.harvests?.length) return existing;

    const pack = productPack(seed, parcel);
    const content = harvestText(seed, parcel, pack);
    const operationId = `local_harvest_${seed.id}_${Date.now()}`;
    const mission = {
      id: operationId,
      operationId,
      parcelId: seed.parcelId,
      status: "completed",
      summary: `Récolte locale produite pour ${seed.title || seed.id}`,
      output: {
        text: `${content}\n\n<!-- HARVEST_COMPLETE -->`,
        harvests: [{
          id: `harvest_${operationId}`,
          title: pack ? `Apprentissages et angles · ${pack.title || seed.title}` : `Observation locale · ${seed.title || seed.id}`,
          description: content.slice(0, 260),
          artifactType: "text/markdown",
          artifact: content,
          content,
        }],
        learnings: pack ? [{
          title: `Direction retenue pour ${pack.title || seed.title}`,
          description: pack.campaignDirection || pack.synopsis || content.slice(0, 300),
          confidence: 0.9,
        }] : [{
          title: `Graine conservée sans blocage`,
          description: `Aucun backend n’est requis pour poursuivre l’apprentissage de cette parcelle.`,
          confidence: 0.7,
        }],
      },
    };

    save({ status: "producing", seedId: seed.id, draftId: draft.id, reason, startedAt: now() });
    const bundle = global.AdventureReturnProcessor.process(draft, mission);
    try {
      global.GardenStore?.updateSeed?.(seed.id, {
        status: "harvest-ready",
        autonomyStatus: "local-harvest-ready",
        lastHarvestAt: now(),
        lastOperationId: operationId,
      });
    } catch (_) {}
    save({ status: "ready", seedId: seed.id, draftId: draft.id, operationId, completedAt: now() });
    try { global.pushChat?.("gerard", `🌾 J’ai produit une récolte locale pour « ${seed.title || seed.id} ». Elle est dans le Garden.`); } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
    try { if (typeof global.render === "function") global.render(); } catch (_) {}
    return bundle;
  }

  global.GerardLocalHarvester = { STATE_KEY, snapshot, harvest };
})(globalThis);
