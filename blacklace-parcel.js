(function blacklaceParcelModule(global) {
  "use strict";

  const PARCEL_ID = "blacklace-ecosystem";
  const ACTIVE_SEED_KEY = "poulpe-fiction:blacklace-active-seed:v1";
  const PARCEL_CACHE_KEY = "poulpe-fiction:blacklace-parcel-cache:v1";
  const CULTIVATION_KEY = "poulpe-fiction:gerard-cultivation:v1";
  // Gérard est un poulpe : il cultive plusieurs Seeds à la fois, une par tentacule.
  const MAX_ACTIVE_TENTACLES = 8;
  const CULTIVATION_POLL_MS = 15_000;

  const parcel = {
    version: 3,
    id: PARCEL_ID,
    code: "PARCEL-001",
    name: "Écosystème Blacklace",
    mission: "Transformer les créations existantes de Benoît en visibilité, ventes, partenaires et apprentissages réels.",
    priorities: ["revenus rapides", "campagnes prêtes", "pages de vente", "prospects qualifiés", "amélioration continue"],
    seeds: [
      { id:"gerard-et-gerard", type:"book", title:"Gérard & Gérard", objective:"Préparer une landing page et une campagne Instagram/TikTok capables de vendre le livre à 20 €.", firstHarvest:"Landing page, hooks, scripts courts, CTA Amazon et calendrier de publication.", priority:1, status:"planted" },
      { id:"terra", type:"book", title:"TERRA", objective:"Identifier son audience la plus réceptive et préparer une campagne de vente directement exploitable.", firstHarvest:"Positionnement, page de présentation, campagne Bookstagram/BookTok et liste de relais.", priority:2, status:"planted" },
      { id:"neverland-ltd", type:"book", title:"Neverland Ltd", objective:"Relancer la visibilité des volumes publiés avec une campagne narrative cohérente.", firstHarvest:"Angle de campagne, séquence de contenus et page de collection.", priority:3, status:"planted" },
      { id:"feulette-tachetee", type:"book", title:"La Feulette Tachetée", objective:"Créer une promotion claire pour les parents, lecteurs jeunesse et cadeaux.", firstHarvest:"Page courte, visuels à produire, posts et ciblage de communautés.", priority:4, status:"planted" },
      { id:"420-dice", type:"game", title:"420 Dice", objective:"Préparer une offre internationale et identifier des partenaires ou distributeurs pertinents.", firstHarvest:"Pitch anglais, fiche produit, liste de prospects et premier email de contact.", priority:5, status:"planted" },
      { id:"prohibited-online", type:"game", title:"Pro.Hibited Online", objective:"Clarifier l'offre numérique actuelle et préparer une première campagne de joueurs/tests.", firstHarvest:"Landing page, promesse, campagne et liste de communautés à contacter.", priority:6, status:"planted" },
      { id:"blacklace-dice", type:"app", title:"Blacklace Dice", objective:"Trouver un angle simple pour attirer les premiers utilisateurs et tester la conversion.", firstHarvest:"Page, démonstration courte, campagne sociale et appel à bêta-testeurs.", priority:7, status:"planted" },
      { id:"creature-sync", type:"app", title:"Creature Sync", objective:"Choisir une audience prioritaire et préparer une bêta publique crédible.", firstHarvest:"Positionnement, page bêta, message de recrutement et protocole de feedback.", priority:8, status:"planted" },
      { id:"feuch-institute", type:"page", title:"Feuch Institute", objective:"Transformer la page en porte d'entrée compréhensible vers l'univers Blacklace.", firstHarvest:"Architecture de page, promesse, SEO de base et contenus d'entrée.", priority:9, status:"planted" },
      { id:"bazar-du-feuch", type:"page", title:"Bazar du Feuch", objective:"Créer une page orientée découverte et conversion pour les créations disponibles.", firstHarvest:"Catalogue priorisé, CTA, page de vente et campagne de lancement.", priority:10, status:"planted" },
      { id:"poulpe-fiction", type:"app", title:"Poulpe Fiction", objective:"Obtenir une première preuve que Gérard produit une récolte utile sans supervision continue.", firstHarvest:"Une aventure réelle terminée avec livrable exploitable et apprentissage mesurable.", priority:11, status:"planted" }
    ]
  };

  function syncGardenDomain(context) {
    try { global.GardenStore?.replaceFromParcel?.(parcel, context || activeSeed()); }
    catch (error) { console.warn("Poulpe Fiction Garden domain sync failed", error); }
  }

  // `render`/`state`/`root`/`pushChat` only exist when the legacy app.js
  // vanilla shell is loaded. mobile-v2.html doesn't load it (its UI is the
  // React app in src/poulpe-fiction-mobile-v2/), so these stay optional and
  // must never throw — Gérard's cultivation loop below must not depend on them.
  function safeRender() {
    try { if (typeof global.render === "function") global.render(); } catch (_) {}
  }

  function safePush(message) {
    try { if (typeof global.pushChat === "function") global.pushChat("gerard", message); } catch (_) {}
  }

  function publisherBaseUrl() {
    try { return global.PublisherClient?.base?.() || (typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""); }
    catch (_) { return ""; }
  }

  function activeSeed() {
    try {
      const value = JSON.parse(localStorage.getItem(ACTIVE_SEED_KEY) || "null");
      return value && value.parcelId === PARCEL_ID ? value : null;
    } catch (_) { return null; }
  }

  function saveActiveSeedLocal(seed) {
    const context = {
      parcelId: PARCEL_ID,
      parcelName: parcel.name,
      seedId: seed.id,
      seedTitle: seed.title,
      objective: seed.objective,
      firstHarvest: seed.firstHarvest,
      selectedAt: new Date().toISOString()
    };
    localStorage.setItem(ACTIVE_SEED_KEY, JSON.stringify(context));
    try { global.GardenStore?.activateSeed?.(PARCEL_ID, seed.id); } catch (_) {}
    return context;
  }

  function cacheParcel() { localStorage.setItem(PARCEL_CACHE_KEY, JSON.stringify(parcel)); }

  function updateSeedStatus(seedId, status, extra) {
    const seed = parcel.seeds.find((item) => item.id === seedId);
    if (!seed) return null;
    Object.assign(seed, extra || {}, { status, updatedAt: new Date().toISOString(), plantedBy: "gerard", gardener: "gerard", plantedAt: seed.plantedAt || seed.createdAt || new Date().toISOString() });
    try { global.GardenStore?.updateSeed?.(seedId, { status, plantedBy: "gerard", gardener: "gerard", plantedAt: seed.plantedAt, ...(extra || {}) }); } catch (_) {}
    cacheParcel();
    return seed;
  }

  async function writeGlobalState(context) {
    const base = publisherBaseUrl();
    if (!base) return false;
    try {
      const response = await fetch(`${base}/api/global-state/parcels/${encodeURIComponent(PARCEL_ID)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcel, activeSeed: context || activeSeed() })
      });
      return response.ok;
    } catch (_) { return false; }
  }

  async function syncFromGlobal() {
    const base = publisherBaseUrl();
    if (!base) return false;
    try {
      const response = await fetch(`${base}/api/global-state/parcels/${encodeURIComponent(PARCEL_ID)}`);
      if (response.status === 404) return writeGlobalState(activeSeed());
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      const record = await response.json();
      const remote = record?.value;
      if (remote?.parcel?.id === PARCEL_ID && Array.isArray(remote.parcel.seeds)) {
        const localById = new Map(parcel.seeds.map((seed) => [seed.id, seed]));
        remote.parcel.seeds.forEach((remoteSeed) => {
          const local = localById.get(remoteSeed.id);
          if (local) Object.assign(local, remoteSeed, { status: normalizeStatus(remoteSeed.status) });
        });
        cacheParcel();
      }
      if (remote?.activeSeed?.parcelId === PARCEL_ID) localStorage.setItem(ACTIVE_SEED_KEY, JSON.stringify(remote.activeSeed));
      syncGardenDomain(remote?.activeSeed || activeSeed());
      safeRender();
      return true;
    } catch (_) {
      try {
        const cached = JSON.parse(localStorage.getItem(PARCEL_CACHE_KEY) || "null");
        if (cached?.id === PARCEL_ID && Array.isArray(cached.seeds)) {
          const cachedById = new Map(cached.seeds.map((seed) => [seed.id, seed]));
          parcel.seeds.forEach((seed) => Object.assign(seed, cachedById.get(seed.id) || {}, { status: normalizeStatus((cachedById.get(seed.id) || seed).status) }));
        }
      } catch (_) {}
      syncGardenDomain(activeSeed());
      return false;
    }
  }

  function normalizeStatus(status) {
    if (["ready", "seed", "resonating", null, undefined, ""].includes(status)) return "planted";
    return status;
  }

  async function loadToolPack(seed) {
    const base = publisherBaseUrl();
    if (!base) return { tools: [], source: "unavailable" };
    try {
      const deliverable = encodeURIComponent(seed.firstHarvest || seed.objective || "production");
      const response = await fetch(`${base}/api/tool-packs/${encodeURIComponent(seed.id)}?deliverable=${deliverable}`);
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      return await response.json();
    } catch (_) { return { tools: [], source: "unavailable" }; }
  }

  function localToolPack(seed) {
    const pack = global.ProductKnowledge?.get?.(seed.id);
    if (!pack) return { tools: [], source: "local" };
    return {
      tools: [
        { id: "publisher-knowledge", name: "Knowledge Pack local", reason: pack.title || seed.title },
        { id: "poulpe-fiction", name: "Poulpe Fiction", reason: "Preparation locale du sac" }
      ],
      source: "local"
    };
  }

  function prepareSeedAdventure(seedId, options) {
    const seed = parcel.seeds.find((item) => item.id === seedId);
    if (!seed || !global.AdventureDraft) return null;

    const currentDraft = global.AdventureDraft.loadBySeed?.(seedId);
    if (currentDraft && currentDraft.status !== "cancelled") {
      updateSeedStatus(seedId, "bag-ready");
      return currentDraft;
    }

    const context = saveActiveSeedLocal(seed);
    updateSeedStatus(seedId, "observing", { observedAt: new Date().toISOString() });
    syncGardenDomain(context);
    cacheParcel();
    void writeGlobalState(context);

    const toolPack = localToolPack(seed);
    const suggestedTools = Array.isArray(toolPack.tools) ? toolPack.tools.slice(0, 6) : [];
    const draft = global.AdventureDraft.create({
      entry: { id: seed.id, title: seed.title, count: 9 },
      objective: seed.objective,
      bag: [
        `la Seed plantée : ${seed.title}`,
        `l'objectif réel : ${seed.objective}`,
        `la première récolte attendue : ${seed.firstHarvest}`,
        "les créations, pages et ressources déjà disponibles dans l'écosystème Blacklace",
        ...suggestedTools.map((tool) => `outil observé : ${tool.name} — ${tool.reason}`)
      ],
      picnic: [
        "Publisher pour préparer les Knowledge Packs utiles",
        suggestedTools.length ? `Tool Pack Publisher : ${suggestedTools.map((tool) => tool.name).join(", ")}` : "Tool Pack Publisher : aucun outil global pertinent mémorisé",
        "quelques tokens Mistral si une rédaction riche est nécessaire"
      ],
      grafts: ["Publisher Curator", "Mistral", ...suggestedTools.map((tool) => tool.id || tool.name)],
      limits: [
        "Aucune publication ni prise de contact sans validation explicite",
        "Un outil observé n'est pas considéré comme connecté tant que son adaptateur réel n'est pas disponible",
        "Produire d'abord des livrables prêts à relire",
        "Privilégier une récolte concrète plutôt qu'un rapport abstrait",
        "Conserver toute piste, question et apprentissage au retour"
      ],
      note: `Gérard a planté puis cultivé cette Seed. Parcelle 001 · ${parcel.name}. Première récolte visée : ${seed.firstHarvest}. Tool Pack : ${toolPack.source || "inconnu"}.`
    });

    const saved = global.AdventureDraft.saveBySeed(draft);
    updateSeedStatus(seedId, "bag-ready", { bagPreparedAt: new Date().toISOString(), adventureDraftId: saved.id });
    if (global.state) global.state.adventureUrge = saved;
    localStorage.setItem(CULTIVATION_KEY, JSON.stringify({ seedId, status: "bag-ready", preparedAt: new Date().toISOString() }));
    void writeGlobalState(context);

    if (!options?.silent) safePush(`🎒 J'ai fait pousser « ${seed.title} » et préparé son sac. Tu peux maintenant autoriser le départ.`);
    safeRender();
    return saved;
  }

  // Gérard est un poulpe : il cultive jusqu'à MAX_ACTIVE_TENTACLES Seeds à la
  // fois, une par tentacule, au lieu d'attendre qu'une Seed soit terminée
  // avant de commencer la suivante. Un tentacule reste occupé (bag-ready →
  // adventure → harvest-ready) jusqu'à ce que le jardinier accepte la récolte
  // (voir GardenPersistence.clearActiveAdventure, qui libère le tentacule).
  async function ensureGerardCultivation() {
    parcel.seeds.forEach((seed) => {
      seed.status = normalizeStatus(seed.status);
      seed.plantedBy = "gerard";
      seed.gardener = "gerard";
      seed.plantedAt = seed.plantedAt || seed.createdAt || new Date().toISOString();
    });
    syncGardenDomain(activeSeed());
    cacheParcel();

    const activeDrafts = global.AdventureDraft?.loadActiveDrafts?.() || [];
    activeDrafts.forEach((draft) => {
      const seed = parcel.seeds.find((item) => item.id === draft.curiosity?.id);
      if (seed && seed.status !== "adventure" && seed.status !== "harvested" && seed.status !== "composted") {
        updateSeedStatus(draft.curiosity.id, "bag-ready", { adventureDraftId: draft.id });
      }
    });

    const occupiedTentacles = activeDrafts.length;
    const freeTentacles = Math.max(0, MAX_ACTIVE_TENTACLES - occupiedTentacles);
    if (freeTentacles <= 0) return;

    const busySeedIds = new Set(activeDrafts.map((draft) => draft.curiosity?.id));
    const candidates = parcel.seeds
      .filter((seed) => !["adventure", "harvested", "composted"].includes(seed.status))
      .filter((seed) => !busySeedIds.has(seed.id))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, freeTentacles);

    for (const candidate of candidates) {
      await prepareSeedAdventure(candidate.id, { silent: true });
    }
  }

  function icon(type) { return type === "book" ? "📚" : type === "game" ? "🎲" : type === "app" ? "📱" : "🌐"; }

  function statusInfo(status) {
    const map = {
      planted: ["🌱", "Plantée par Gérard", "Gérard l'a mise en terre et la garde dans son jardin."],
      observing: ["👀", "En observation", "Gérard rassemble les signaux et vérifie ce qui existe déjà."],
      growing: ["🌿", "En croissance", "La Seed gagne en cohérence et en utilité."],
      "bag-ready": ["🎒", "Sac prêt", "Gérard a préparé l'objectif, les outils et les limites."],
      adventure: ["🐙", "En aventure", "Octopus exécute la mission autorisée."],
      harvested: ["🌾", "Récolte disponible", "Une sortie réelle est revenue au Garden."],
      composted: ["🍂", "Au compost", "La piste est arrêtée, mais ses apprentissages sont conservés."]
    };
    return map[status] || map.planted;
  }

  function renderParcel() {
    const active = activeSeed();
    const draft = global.AdventureDraft?.load?.();
    const activeDefinition = active ? parcel.seeds.find((seed) => seed.id === active.seedId) : null;
    const sortedSeeds = parcel.seeds.slice().sort((a,b) => a.priority-b.priority);

    const activeCard = activeDefinition ? (() => {
      const info = statusInfo(activeDefinition.status);
      const draftMatches = draft && draft.curiosity?.id === activeDefinition.id && draft.status !== "cancelled";
      const actions = activeDefinition.status === "bag-ready" && draftMatches
        ? `<div class="seed-primary-actions"><button class="ghost" type="button" data-view-bag>🎒 Voir le sac</button><button class="primary" type="button" data-authorize-departure="${esc(activeDefinition.id)}">🚀 Autoriser le départ</button></div>`
        : activeDefinition.status === "adventure"
          ? `<div class="seed-primary-actions"><button class="primary" type="button" data-view-mission>🐙 Suivre l'aventure</button></div>`
          : `<div class="seed-care-note"><strong>${info[0]} ${info[1]}</strong><small>${esc(info[2])}</small><span>Gérard s'en occupe. Aucun clic technique n'est nécessaire.</span></div>`;

      return `<article class="active-seed"><div><p class="eyebrow">Parcelle active · ${info[0]} ${esc(info[1])}</p><h2>${icon(activeDefinition.type)} ${esc(activeDefinition.title)}</h2><p>${esc(activeDefinition.objective)}</p><small>Première récolte : ${esc(activeDefinition.firstHarvest)}</small>${actions}</div></article>`;
    })() : `<article class="active-seed empty"><div><p class="eyebrow">Jardin de Gérard</p><h2>Gérard plante les Seeds automatiquement</h2><p>Il choisit la première graine à cultiver et prépare un sac lorsqu'elle est mûre.</p></div></article>`;

    const seedRows = sortedSeeds.map((seed) => {
      const selected = active?.seedId === seed.id;
      const info = statusInfo(seed.status);
      return `<button class="seed-row${selected ? " selected" : ""}" data-blacklace-seed="${esc(seed.id)}" type="button"><span class="seed-icon">${info[0]}</span><span class="seed-copy"><strong>${esc(seed.title)}</strong><small>${esc(info[1])}</small></span><span class="seed-action">${selected ? "Ouverte" : "Observer"}</span></button>`;
    }).join("");

    const counts = sortedSeeds.reduce((acc, seed) => { acc[seed.status] = (acc[seed.status] || 0) + 1; return acc; }, {});
    const summary = `<div class="seed-life-summary"><span>🌱 ${counts.planted || 0} plantée(s)</span><span>👀 ${(counts.observing || 0) + (counts.growing || 0)} en pousse</span><span>🎒 ${counts["bag-ready"] || 0} sac(s) prêt(s)</span><span>🐙 ${counts.adventure || 0} aventure(s)</span><span>🌾 ${counts.harvested || 0} récolte(s)</span></div>`;

    return `<section class="blacklace-parcel garden-primary"><div class="parcel-heading"><div><p class="eyebrow">🌱 ${parcel.code} · jardinée par Gérard</p><strong>${esc(parcel.name)}</strong></div><small>Toute Seed est plantée automatiquement.</small></div>${summary}${activeCard}<details class="seed-picker"${active ? "" : " open"}><summary>Voir les ${sortedSeeds.length} Seeds plantées</summary><div class="seed-list">${seedRows}</div></details></section>`;
  }

  function bindParcelActions() {
    document.querySelectorAll("[data-blacklace-seed]").forEach((button) => {
      button.onclick = () => {
        const seed = parcel.seeds.find((item) => item.id === button.dataset.blacklaceSeed);
        if (!seed) return;
        saveActiveSeedLocal(seed);
        syncGardenDomain(activeSeed());
        safeRender();
      };
    });
    document.querySelectorAll("[data-view-mission]").forEach((button) => {
      button.onclick = () => global.GardenShell?.setActiveView?.("missions");
    });
  }

  global.BlacklaceParcel = { PARCEL_ID, ACTIVE_SEED_KEY, PARCEL_CACHE_KEY, MAX_ACTIVE_TENTACLES, parcel, activeSeed, prepareSeedAdventure, ensureGerardCultivation, renderParcel, syncFromGlobal, writeGlobalState, loadToolPack, syncGardenDomain };

  // Optional legacy vanilla-template hook — see safeRender() above.
  if (typeof global.render === "function") {
    const baseRender = global.render;
    global.render = function renderWithBlacklaceParcel() {
      baseRender();
      if (global.state?.step !== "objective") return;
      const existing = global.root?.querySelector?.(".blacklace-parcel");
      if (!existing) {
        const chat = global.root?.querySelector?.(".gerard-chat");
        if (chat) chat.insertAdjacentHTML("beforebegin", renderParcel());
        else global.root?.insertAdjacentHTML?.("afterbegin", renderParcel());
      }
      bindParcelActions();
    };
  }

  syncGardenDomain(activeSeed());
  safeRender();
  void syncFromGlobal().finally(() => ensureGerardCultivation().then(() => safeRender()));

  // Refait le point régulièrement : dès qu'un tentacule se libère (récolte
  // acceptée par le jardinier), Gérard reprend une nouvelle Seed sans qu'il
  // faille recharger la page.
  global.setInterval(() => { void ensureGerardCultivation().then(() => safeRender()); }, CULTIVATION_POLL_MS);
})(globalThis);
