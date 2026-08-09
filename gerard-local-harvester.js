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

  // Gérard n'attend plus un signal humain pour continuer à travailler une
  // Seed : chaque passage doit aller plus loin que le précédent, jamais se
  // répéter à l'identique. On regarde donc ce qui a déjà été produit avant
  // de demander une nouvelle itération.
  function priorHarvests(seedId) {
    const harvests = global.GardenStore?.snapshot?.()?.harvests || [];
    return harvests
      .filter((item) => item?.seedId === seedId && text(item?.content?.text || item?.content))
      .sort((a, b) => Date.parse(b?.createdAt || 0) - Date.parse(a?.createdAt || 0));
  }

  // La graine « poulpe-fiction » elle-même a une question spécifique : qui
  // sont les futurs clients de Poulpe Fiction ? Gérard n'a aucune donnée
  // externe pour ça (pas de scraping, pas d'accès LinkedIn), mais il a un
  // indice réel et légitime sous la main : le catalogue des autres créations
  // qu'il cultive déjà. On lui demande donc des hypothèses de personas
  // explicitement étiquetées comme telles — jamais présentées comme des
  // faits vérifiés.
  function catalogSummary(seed) {
    if (seed?.id !== "poulpe-fiction") return "";
    const seeds = global.GardenStore?.snapshot?.()?.seeds || [];
    const siblings = seeds.filter((item) => item?.parcelId === seed.parcelId && item?.id !== seed.id && text(item?.title));
    if (!siblings.length) return "";
    return siblings.map((item) => `- ${item.title} (${item.type || "création"}) : ${text(item.objective) || "objectif non précisé"}`).join("\n");
  }

  async function requestMistralDraft(seed, groundingText, iterationNumber, latestHarvest) {
    const priorContent = text(latestHarvest?.content?.text || latestHarvest?.content);
    const catalog = catalogSummary(seed);
    const personaTask = catalog
      ? [
          "Tâche spécifique de cette graine : Poulpe Fiction cherche à savoir qui sont ses futurs clients — les créateurs qui auraient besoin de Gérard.",
          `Catalogue réel déjà cultivé par ce même jardinier, comme indice du type de créateur concerné :\n${catalog}`,
          "Propose 3 personas plausibles de créateurs indépendants qui pourraient vouloir Poulpe Fiction, avec pour chacun : un profil type, ce qui les bloque aujourd'hui, et pourquoi Gérard leur serait utile.",
          "Étiquette explicitement ces personas comme des hypothèses de travail à valider — jamais comme des faits vérifiés, aucun nom réel, aucune statistique inventée.",
        ].join("\n\n")
      : "";
    const prompt = [
      `Graine : ${seed.title || seed.id}`,
      `Objectif : ${seed.objective || "non précisé"}`,
      `Première récolte visée : ${seed.firstHarvest || "non précisée"}`,
      groundingText ? `Faits vérifiés disponibles :\n${groundingText}` : "Aucun fait vérifié externe disponible pour l'instant — reste strictement dans le brief ci-dessus.",
      priorContent ? `Récolte précédente (itération ${iterationNumber - 1}, à dépasser sans la répéter) :\n${priorContent.slice(0, 900)}` : "",
      personaTask,
      "Produis un livrable court, concret et directement exploitable pour cette étape (angle, accroche ou premier élément de contenu).",
      "N'invente aucun fait vérifiable : pas de chiffre, pas de témoignage, pas de preuve sociale, pas de nom de personne réelle.",
      priorContent ? "Va réellement plus loin que la récolte précédente : ajoute un élément nouveau, plus abouti ou plus concret plutôt que de reformuler." : "",
    ].filter(Boolean).join("\n\n");

    const payload = await global.PublisherClient?.execute?.("mistral", "copy.generate", { title: seed.title || seed.id, prompt });
    const draftContent = text(payload?.artifact?.content);
    if (!draftContent) return null;
    return { content: draftContent, provider: "publisher-mistral" };
  }

  // En plus du texte, Gérard tente de faire naître un visuel réel via
  // Composio/Canva (même endpoint Publisher, action canva/create_design,
  // vérifié fonctionnel manuellement). Le résultat est un lien d'édition
  // Canva réel — pas une image directement affichable — donc on le relie
  // en clair dans la récolte plutôt que d'inventer une prévisualisation.
  async function requestCanvaVisual(seed, iterationNumber) {
    const title = `${seed?.title || seed?.id || "Poulpe Fiction"} · itération ${iterationNumber}`;
    const payload = await global.PublisherClient?.execute?.("canva", "create_design", { title });
    const artifact = payload?.artifact;
    const url = text(artifact?.url);
    if (!url) return null;
    return { url, title: text(artifact?.title) || title, designId: text(artifact?.rawReference?.designId) };
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

  function harvestText(seed, parcel, pack, draft, publisherPack, iterationNumber = 1, latestHarvest = null) {
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

    const firstHarvestBrief = text(seed?.firstHarvest);
    const lines = [
      `# Récolte · ${seed?.title || "Graine"} (itération ${iterationNumber})`,
      "",
      `## Mission traitée`,
      objective || `Gérard a inspecté la graine « ${seed?.title || seed?.id} » dans ${parcel?.name || seed?.parcelId || "la parcelle"}.`,
      "",
      `## Apprentissage`,
      pick(EMPTY_OPENERS),
    ];
    if (firstHarvestBrief) {
      lines.push(
        "",
        `## Cible fixée par la parcelle`,
        firstHarvestBrief,
        `Ceci est le brief tel qu'écrit dans la parcelle — pas une donnée inventée par Gérard, juste pas encore transformée en livrable faute de source Mistral/Publisher disponible.`,
      );
    }
    if (latestHarvest) {
      lines.push("", `## Depuis la dernière itération`, `Gérard revient sur cette graine sans repartir de zéro ; il attend une source (Publisher ou Mistral) pour vraiment aller plus loin que la fois précédente.`);
    }
    lines.push("", `## Prochaine action interne`, pick(EMPTY_NEXT_ACTIONS));
    return lines.join("\n");
  }

  async function harvest(draft, reason = "local-first") {
    if (!draft?.id || !global.AdventureReturnProcessor?.process) {
      throw new Error("Le processeur de récolte locale n’est pas prêt.");
    }

    const { seed, parcel } = activeSeed(draft);
    if (!seed) throw new Error("Aucune graine active à récolter.");

    const pack = productPack(seed, parcel);
    const publisherPack = await fetchPublisherPack(seed, parcel);
    const priors = priorHarvests(seed.id);
    const latestHarvest = priors[0] || null;
    const iterationNumber = priors.length + 1;

    // Gérard tente toujours une vraie itération générative (via Publisher/
    // Mistral), grounded dans les faits vérifiés disponibles et dans ce qui
    // a déjà été produit — jamais dans le vide, jamais une répétition.
    const groundingText = publisherPack?.verified && publisherPack.prompt ? publisherPack.prompt.slice(0, 1600) : "";
    const [mistralDraft, canvaVisual] = await Promise.all([
      requestMistralDraft(seed, groundingText, iterationNumber, latestHarvest),
      requestCanvaVisual(seed, iterationNumber),
    ]);

    const baseContent = mistralDraft?.content || harvestText(seed, parcel, pack, draft, publisherPack, iterationNumber, latestHarvest);
    const content = canvaVisual
      ? `${baseContent}\n\n## Visuel créé par Gérard\nUn tentacule est aussi reparti avec un visuel Canva pour accompagner cette récolte : [${canvaVisual.title}](${canvaVisual.url}).`
      : baseContent;
    const operationId = `local_harvest_${seed.id}_${Date.now()}`;
    const usesPublisher = Boolean(publisherPack?.verified && publisherPack.prompt);
    const mission = {
      id: operationId,
      operationId,
      parcelId: seed.parcelId,
      status: "completed",
      summary: `Récolte produite pour ${seed.title || seed.id} (itération ${iterationNumber})`,
      output: {
        text: `${content}\n\n<!-- HARVEST_COMPLETE -->`,
        // A single harvest item per mission, on purpose: adventure-return.js
        // gives every item in this array the same operationId, and
        // restoreGardenHarvest.ts (the React Garden UI) treats operationId
        // as the mission's dedup key — one bundle per mission, most-recent
        // wins. A second "visual" item here previously collided on that key
        // and silently shadowed the real text harvest (the Canva URL won
        // the dedup instead), which is why v3 improvements briefly appeared
        // and then vanished from the Garden. The Canva link already lives
        // inline in `content` above ("## Visuel créé par Gérard"), so
        // nothing is lost by not duplicating it as its own harvest entry.
        harvests: [{
          id: `harvest_${operationId}`,
          title: mistralDraft ? `Récolte · ${seed.title || seed.id} (v${iterationNumber})` : !usesPublisher && pack ? `Récolte · ${pack.title || seed.title}` : `Récolte · ${seed.title || seed.id}`,
          description: content.slice(0, 260),
          artifactType: "text/markdown",
          artifact: content,
          content,
          url: canvaVisual?.url || undefined,
        }],
        learnings: [
          ...(mistralDraft ? [{
            title: `Itération ${iterationNumber} générée pour ${seed.title || seed.id}`,
            description: latestHarvest ? "Construite en allant plus loin que la récolte précédente." : "Premier jet généré à partir du brief de la parcelle.",
            confidence: 0.85,
          }] : usesPublisher ? [{
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
          }]),
          ...(canvaVisual ? [{
            title: `Visuel Canva créé pour ${seed.title || seed.id}`,
            description: `Un design Canva réel a été généré via Composio pour cette itération : ${canvaVisual.title}.`,
            confidence: 0.8,
          }] : []),
        ],
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
    try {
      global.pushChat?.("gerard", canvaVisual
        ? `🌾🎨 J’ai produit une nouvelle récolte pour « ${seed.title || seed.id} », avec un visuel Canva en prime. Tout est dans le Garden.`
        : `🌾 J’ai produit une nouvelle récolte pour « ${seed.title || seed.id} ». Elle est dans le Garden.`);
    } catch (_) {}
    try { global.GardenShell?.mount?.(); } catch (_) {}
    try { if (typeof global.render === "function") global.render(); } catch (_) {}
    return bundle;
  }

  global.GerardLocalHarvester = { STATE_KEY, snapshot, harvest };
})(globalThis);