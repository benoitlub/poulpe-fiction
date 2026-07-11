(function blacklaceParcelModule(global) {
  "use strict";

  const PARCEL_ID = "blacklace-ecosystem";
  const ACTIVE_SEED_KEY = "poulpe-fiction:blacklace-active-seed:v1";
  const PARCEL_CACHE_KEY = "poulpe-fiction:blacklace-parcel-cache:v1";

  const parcel = {
    version: 2,
    id: PARCEL_ID,
    code: "PARCEL-001",
    name: "Écosystème Blacklace",
    mission: "Transformer les créations existantes de Benoît en visibilité, ventes, partenaires et apprentissages réels.",
    priorities: ["revenus rapides", "campagnes prêtes", "pages de vente", "prospects qualifiés", "amélioration continue"],
    seeds: [
      { id:"gerard-et-gerard", type:"book", title:"Gérard & Gérard", objective:"Préparer une landing page et une campagne Instagram/TikTok capables de vendre le livre à 20 €.", firstHarvest:"Landing page, hooks, scripts courts, CTA Amazon et calendrier de publication.", priority:1, status:"ready" },
      { id:"terra", type:"book", title:"TERRA", objective:"Identifier son audience la plus réceptive et préparer une campagne de vente directement exploitable.", firstHarvest:"Positionnement, page de présentation, campagne Bookstagram/BookTok et liste de relais.", priority:2, status:"ready" },
      { id:"neverland-ltd", type:"book", title:"Neverland Ltd", objective:"Relancer la visibilité des volumes publiés avec une campagne narrative cohérente.", firstHarvest:"Angle de campagne, séquence de contenus et page de collection.", priority:3, status:"ready" },
      { id:"feulette-tachetee", type:"book", title:"La Feulette Tachetée", objective:"Créer une promotion claire pour les parents, lecteurs jeunesse et cadeaux.", firstHarvest:"Page courte, visuels à produire, posts et ciblage de communautés.", priority:4, status:"ready" },
      { id:"420-dice", type:"game", title:"420 Dice", objective:"Préparer une offre internationale et identifier des partenaires ou distributeurs pertinents.", firstHarvest:"Pitch anglais, fiche produit, liste de prospects et premier email de contact.", priority:5, status:"ready" },
      { id:"prohibited-online", type:"game", title:"Pro.Hibited Online", objective:"Clarifier l'offre numérique actuelle et préparer une première campagne de joueurs/tests.", firstHarvest:"Landing page, promesse, campagne et liste de communautés à contacter.", priority:6, status:"ready" },
      { id:"blacklace-dice", type:"app", title:"Blacklace Dice", objective:"Trouver un angle simple pour attirer les premiers utilisateurs et tester la conversion.", firstHarvest:"Page, démonstration courte, campagne sociale et appel à bêta-testeurs.", priority:7, status:"ready" },
      { id:"creature-sync", type:"app", title:"Creature Sync", objective:"Choisir une audience prioritaire et préparer une bêta publique crédible.", firstHarvest:"Positionnement, page bêta, message de recrutement et protocole de feedback.", priority:8, status:"ready" },
      { id:"feuch-institute", type:"page", title:"Feuch Institute", objective:"Transformer la page en porte d'entrée compréhensible vers l'univers Blacklace.", firstHarvest:"Architecture de page, promesse, SEO de base et contenus d'entrée.", priority:9, status:"ready" },
      { id:"bazar-du-feuch", type:"page", title:"Bazar du Feuch", objective:"Créer une page orientée découverte et conversion pour les créations disponibles.", firstHarvest:"Catalogue priorisé, CTA, page de vente et campagne de lancement.", priority:10, status:"ready" },
      { id:"poulpe-fiction", type:"app", title:"Poulpe Fiction", objective:"Obtenir une première preuve que Gérard produit une récolte utile sans supervision continue.", firstHarvest:"Une aventure réelle terminée avec livrable exploitable et apprentissage mesurable.", priority:11, status:"ready" }
    ]
  };

  function publisherBaseUrl() {
    try { return typeof PUBLISHER_API === "string" ? PUBLISHER_API.replace(/\/$/, "") : ""; }
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
    return context;
  }

  function cacheParcel() {
    localStorage.setItem(PARCEL_CACHE_KEY, JSON.stringify(parcel));
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
        Object.assign(parcel, remote.parcel);
        cacheParcel();
      }
      if (remote?.activeSeed?.parcelId === PARCEL_ID) {
        localStorage.setItem(ACTIVE_SEED_KEY, JSON.stringify(remote.activeSeed));
      }
      render();
      return true;
    } catch (_) {
      try {
        const cached = JSON.parse(localStorage.getItem(PARCEL_CACHE_KEY) || "null");
        if (cached?.id === PARCEL_ID && Array.isArray(cached.seeds)) Object.assign(parcel, cached);
      } catch (_) {}
      return false;
    }
  }

  async function loadToolPack(seed) {
    const base = publisherBaseUrl();
    if (!base) return { tools: [], source: "unavailable" };
    try {
      const deliverable = encodeURIComponent(seed.firstHarvest || seed.objective || "production");
      const response = await fetch(`${base}/api/tool-packs/${encodeURIComponent(seed.id)}?deliverable=${deliverable}`);
      if (!response.ok) throw new Error(`Publisher ${response.status}`);
      return await response.json();
    } catch (_) {
      return { tools: [], source: "unavailable" };
    }
  }

  async function prepareSeedAdventure(seedId) {
    const seed = parcel.seeds.find((item) => item.id === seedId);
    if (!seed || !global.AdventureDraft) return;

    const context = saveActiveSeedLocal(seed);
    cacheParcel();
    void writeGlobalState(context);
    const toolPack = await loadToolPack(seed);
    const suggestedTools = Array.isArray(toolPack.tools) ? toolPack.tools.slice(0, 6) : [];

    const draft = global.AdventureDraft.create({
      entry: { id: seed.id, title: seed.title, count: 9 },
      objective: seed.objective,
      bag: [
        `la Seed : ${seed.title}`,
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
      note: `Parcelle 001 · ${parcel.name}. Première récolte visée : ${seed.firstHarvest}. Tool Pack : ${toolPack.source || "inconnu"}.`
    });
    global.AdventureDraft.save(draft);
    state.adventureUrge = draft;
    pushChat("gerard", suggestedTools.length
      ? `🌱 J'ai choisi « ${seed.title} » dans la Parcelle 001 et consulté la mémoire globale de Publisher. ${suggestedTools.length} outil${suggestedTools.length > 1 ? "s" : ""} observé${suggestedTools.length > 1 ? "s" : ""} accompagne${suggestedTools.length > 1 ? "nt" : ""} le sac.`
      : `🌱 J'ai choisi « ${seed.title} » dans la Parcelle 001. Aucun outil global pertinent n'est encore mémorisé, donc je pars avec le sac de base.`);
    render();
  }

  function icon(type) { return type === "book" ? "📚" : type === "game" ? "🎲" : type === "app" ? "📱" : "🌐"; }

  function renderParcel() {
    const active = activeSeed();
    const seeds = parcel.seeds.slice().sort((a,b) => a.priority-b.priority).map((seed) =>
      `<article class="plan-item"><strong>${icon(seed.type)} ${esc(seed.title)}</strong><p>${esc(seed.objective)}</p><small>Première récolte : ${esc(seed.firstHarvest)}</small><div class="play-actions"><button class="${active?.seedId === seed.id ? "ghost" : "primary"}" data-blacklace-seed="${esc(seed.id)}">${active?.seedId === seed.id ? "🎒 Sac préparé" : "🌱 Confier à Gérard"}</button></div></article>`
    ).join("");
    return `<section class="blacklace-parcel"><p class="eyebrow">🌱 ${parcel.code} · synchronisée</p><h2>${esc(parcel.name)}</h2><p>${esc(parcel.mission)}</p><div class="plans">${seeds}</div><small>Mobile et PC utilisent la même parcelle via Publisher. Le navigateur garde seulement un cache hors ligne.</small></section>`;
  }

  function bindParcelActions() {
    document.querySelectorAll("[data-blacklace-seed]").forEach((button) => {
      button.onclick = () => { void prepareSeedAdventure(button.dataset.blacklaceSeed); };
    });
  }

  global.BlacklaceParcel = { PARCEL_ID, ACTIVE_SEED_KEY, PARCEL_CACHE_KEY, parcel, activeSeed, prepareSeedAdventure, renderParcel, syncFromGlobal, writeGlobalState, loadToolPack };

  const baseRender = render;
  render = function renderWithBlacklaceParcel() {
    baseRender();
    if (state.step !== "objective") return;
    const existing = root.querySelector(".blacklace-parcel");
    if (!existing) root.insertAdjacentHTML("beforeend", renderParcel());
    bindParcelActions();
  };

  render();
  void syncFromGlobal();
})(globalThis);
