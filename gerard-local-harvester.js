(function gerardLocalHarvesterModule(global) {
  "use strict";

  const STATE_KEY = "poulpe-fiction:gerard-local-harvester:v2";
  const now = () => new Date().toISOString();
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

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

  // Publisher (autonomous Notion curator) takes priority over the local
  // static ProductKnowledge bundle when it has a verified source — that is
  // real, up-to-date knowledge rather than a hardcoded fallback.
  async function fetchPublisherPack(seed, parcel) {
    const slug = text(seed?.knowledgeSlug) || text(parcel?.knowledgeSlug) || text(seed?.id);
    try {
      return await global.PublisherKnowledge?.load?.(slug);
    } catch (_) {
      return null;
    }
  }

  // Gérard reste factuellement honnête (jamais de chiffre, preuve ou fait
  // inventé) mais n'a pas besoin d'être procédural pour autant : on varie
  // les formulations pour que ses récoltes sonnent comme un poulpe curieux
  // qui explore, pas comme un rapport de statut.
  const PUBLISHER_OPENERS = [
    "Une tentacule est redescendue avec quelque chose de solide cette fois : du vérifié, pas du deviné.",
    "Gérard a fouillé dans ce que Publisher sait vraiment, sans rien y ajouter de son cru.",
    "Publisher avait déjà la réponse quelque part dans ses eaux profondes ; Gérard l'a remontée telle quelle.",
  ];
  const PUBLISHER_NEXT_ACTIONS = [
    "Un tentacule prépare déjà la suite à partir de ces faits — rien d'autre n'est ajouté.",
    "Prochaine étape : sculpter ça en un premier livrable concret, sans broder autour.",
    "Gérard garde cette matière au chaud pour la transformer en quelque chose d'exploitable, fidèlement.",
  ];
  const LOCAL_OPENERS = [
    "Gérard a ressorti ce qu'il connaît déjà par cœur sur cette graine.",
    "Pas besoin d'aller chercher loin : Gérard avait déjà cette piste en mémoire.",
    "Une vieille intuition confirmée par ce que Gérard garde dans ses carnets.",
  ];
  const LOCAL_NEXT_ACTIONS = [
    "Préparer une publication courte à partir de l'angle 1, sans inventer de preuve sociale, de chiffre ou d'urgence.",
    "Tester le premier angle en petit avant d'aller plus loin — Gérard préfère avancer par petites vagues.",
    "Garder les deux autres angles au chaud ; celui-ci part en premier voir ce qu'il donne.",
  ];
  const EMPTY_OPENERS = [
    "Gérard a observé la graine avec attention, mais n'a encore rien de vérifié à raconter — il préfère se taire plutôt qu'inventer.",
    "Pas encore de fait solide sous la tentacule. Gérard note, observe, et patiente sans brusquer la graine.",
    "Cette graine dort encore un peu dans le noir. Gérard veille dessus, curieux, sans forcer une récolte imaginaire.",
    "Rien d'assez sûr à ramener aujourd'hui — Gérard préfère revenir bredouille que raconter une fausse histoire.",
  ];
  const EMPTY_NEXT_ACTIONS = [
    "Rassembler les faits vérifiés disponibles dans la parcelle, puis proposer un premier livrable limité à ces faits.",
    "Aller regarder du côté de Publisher et de ce que la parcelle sait déjà avant de tenter quoi que ce soit.",
    "Laisser la graine mûrir encore un peu ; Gérard repassera dès qu'il aura une vraie prise.",
  ];

  function harvestText(seed, parcel, pack, draft, publisherPack) {
    const objective = text(draft?.objective) || text(seed?.objective || seed?.content);
    if (publisherPack?.verified && publisherPack.prompt) {
      const sourceTitles = Array.isArray(publisherPack.items) ? publisherPack.items.map((item) => text(item?.title)).filter(Boolean) : [];
      const excerpt = publisherPack.prompt.length > 1400 ? `${publisherPack.prompt.slice(0, 1400)}…` : publisherPack.prompt;
      const lines = [
        `# Récolte · ${seed?.title || "Graine"}`,
        "",
        `## Mission traitée`,
        objective || `Cultiver « ${seed?.title || seed?.id} »`,
        "",
        `## Ce que Publisher a vérifié`,
        pick(PUBLISHER_OPENERS),
        "",
        excerpt,
      ];
      if (sourceTitles.length) lines.push("", `## Sources`, ...sourceTitles.map((title) => `- ${title}`));
      lines.push("", `## Prochaine action interne`, pick(PUBLISHER_NEXT_ACTIONS));
      return lines.join("\n");
    }
    if (pack) {
      const angles = Array.isArray(pack.sampleAngles) ? pack.sampleAngles.slice(0, 3) : [];
      const audiences = Array.isArray(pack.audienceHypotheses) ? pack.audienceHypotheses.slice(0, 3) : [];
      return [
        `# Récolte · ${pack.title || seed.title}`,
        "",
        `## Mission traitée`,
        objective || `Cultiver « ${seed?.title || seed?.id} »`,
        "",
        `## Ce que Gérard a appris`,
        pick(LOCAL_OPENERS),
        `Le noyau commercial le plus fidèle est : ${pack.campaignDirection || pack.synopsis || objective}`,
        "",
        `## Publics à tester`,
        ...audiences.map((item) => `- ${item}`),
        "",
        `## Trois angles immédiatement exploitables`,
        ...angles.map((item, index) => `${index + 1}. ${item}`),
        "",
        `## Prochaine action interne`,
        pick(LOCAL_NEXT_ACTIONS),
      ].join("\n");
    }

    return [
      `# Récolte · ${seed?.title || "Graine"}`,
      "",
      `## Mission traitée`,
      objective || `Gérard a inspecté la graine « ${seed?.title || seed?.id} » dans ${parcel?.name || seed?.parcelId || "la parcelle"}.`,
      "",
      `## Apprentissage`,
      pick(EMPTY_OPENERS),
      "",
      `## Prochaine action interne`,
      pick(EMPTY_NEXT_ACTIONS),
    ].join("\n");
  }

  async function harvest(draft, reason = "local-first") {
    if (!draft?.id || !global.AdventureReturnProcessor?.process) {
      throw new Error("Le processeur de récolte locale n’est pas prêt.");
    }

    const { seed, parcel } = activeSeed(draft);
    if (!seed) throw new Error("Aucune graine active à récolter.");

    const pack = productPack(seed, parcel);
    const publisherPack = await fetchPublisherPack(seed, parcel);
    const content = harvestText(seed, parcel, pack, draft, publisherPack);
    const operationId = `local_harvest_${seed.id}_${Date.now()}`;
    const usesPublisher = Boolean(publisherPack?.verified && publisherPack.prompt);
    const mission = {
      id: operationId,
      operationId,
      parcelId: seed.parcelId,
      status: "completed",
      summary: `Récolte produite pour ${seed.title || seed.id}`,
      output: {
        text: `${content}\n\n<!-- HARVEST_COMPLETE -->`,
        harvests: [{
          id: `harvest_${operationId}`,
          title: !usesPublisher && pack ? `Récolte · ${pack.title || seed.title}` : `Récolte · ${seed.title || seed.id}`,
          description: content.slice(0, 260),
          artifactType: "text/markdown",
          artifact: content,
          content,
        }],
        learnings: usesPublisher ? [{
          title: `Connaissance vérifiée trouvée chez Publisher pour ${seed.title || seed.id}`,
          description: text(publisherPack.items?.[0]?.title) || content.slice(0, 300),
          confidence: 0.95,
        }] : pack ? [{
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
    try { global.pushChat?.("gerard", `🌾 J’ai produit une nouvelle récolte pour « ${seed.title || seed.id} ». Elle est dans le Garden.`); } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
    try { if (typeof global.render === "function") global.render(); } catch (_) {}
    return bundle;
  }

  global.GerardLocalHarvester = { STATE_KEY, snapshot, harvest };
})(globalThis);