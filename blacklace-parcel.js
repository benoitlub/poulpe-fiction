(function blacklaceParcelModule(global) {
  "use strict";

  const PARCEL_ID = "blacklace-ecosystem";
  const ACTIVE_SEED_KEY = "poulpe-fiction:blacklace-active-seed:v1";

  const parcel = {
    version: 1,
    id: PARCEL_ID,
    code: "PARCEL-001",
    name: "Écosystème Blacklace",
    mission: "Transformer les créations existantes de Benoît en visibilité, ventes, partenaires et apprentissages réels.",
    priorities: ["revenus rapides", "campagnes prêtes", "pages de vente", "prospects qualifiés", "amélioration continue"],
    seeds: [
      {
        id: "gerard-et-gerard",
        type: "book",
        title: "Gérard & Gérard",
        objective: "Préparer une landing page et une campagne Instagram/TikTok capables de vendre le livre à 20 €.",
        firstHarvest: "Landing page, hooks, scripts courts, CTA Amazon et calendrier de publication.",
        priority: 1,
        status: "ready"
      },
      {
        id: "terra",
        type: "book",
        title: "TERRA",
        objective: "Identifier son audience la plus réceptive et préparer une campagne de vente directement exploitable.",
        firstHarvest: "Positionnement, page de présentation, campagne Bookstagram/BookTok et liste de relais.",
        priority: 2,
        status: "ready"
      },
      {
        id: "neverland-ltd",
        type: "book",
        title: "Neverland Ltd",
        objective: "Relancer la visibilité des volumes publiés avec une campagne narrative cohérente.",
        firstHarvest: "Angle de campagne, séquence de contenus et page de collection.",
        priority: 3,
        status: "ready"
      },
      {
        id: "feulette-tachetee",
        type: "book",
        title: "La Feulette Tachetée",
        objective: "Créer une promotion claire pour les parents, lecteurs jeunesse et cadeaux.",
        firstHarvest: "Page courte, visuels à produire, posts et ciblage de communautés.",
        priority: 4,
        status: "ready"
      },
      {
        id: "420-dice",
        type: "game",
        title: "420 Dice",
        objective: "Préparer une offre internationale et identifier des partenaires ou distributeurs pertinents.",
        firstHarvest: "Pitch anglais, fiche produit, liste de prospects et premier email de contact.",
        priority: 5,
        status: "ready"
      },
      {
        id: "prohibited-online",
        type: "game",
        title: "Pro.Hibited Online",
        objective: "Clarifier l'offre numérique actuelle et préparer une première campagne de joueurs/tests.",
        firstHarvest: "Landing page, promesse, campagne et liste de communautés à contacter.",
        priority: 6,
        status: "ready"
      },
      {
        id: "blacklace-dice",
        type: "app",
        title: "Blacklace Dice",
        objective: "Trouver un angle simple pour attirer les premiers utilisateurs et tester la conversion.",
        firstHarvest: "Page, démonstration courte, campagne sociale et appel à bêta-testeurs.",
        priority: 7,
        status: "ready"
      },
      {
        id: "creature-sync",
        type: "app",
        title: "Creature Sync",
        objective: "Choisir une audience prioritaire et préparer une bêta publique crédible.",
        firstHarvest: "Positionnement, page bêta, message de recrutement et protocole de feedback.",
        priority: 8,
        status: "ready"
      },
      {
        id: "feuch-institute",
        type: "page",
        title: "Feuch Institute",
        objective: "Transformer la page en porte d'entrée compréhensible vers l'univers Blacklace.",
        firstHarvest: "Architecture de page, promesse, SEO de base et contenus d'entrée.",
        priority: 9,
        status: "ready"
      },
      {
        id: "bazar-du-feuch",
        type: "page",
        title: "Bazar du Feuch",
        objective: "Créer une page orientée découverte et conversion pour les créations disponibles.",
        firstHarvest: "Catalogue priorisé, CTA, page de vente et campagne de lancement.",
        priority: 10,
        status: "ready"
      },
      {
        id: "poulpe-fiction",
        type: "app",
        title: "Poulpe Fiction",
        objective: "Obtenir une première preuve que Gérard produit une récolte utile sans supervision continue.",
        firstHarvest: "Une aventure réelle terminée avec livrable exploitable et apprentissage mesurable.",
        priority: 11,
        status: "ready"
      }
    ]
  };

  function activeSeed() {
    try {
      const value = JSON.parse(localStorage.getItem(ACTIVE_SEED_KEY) || "null");
      return value && value.parcelId === PARCEL_ID ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveActiveSeed(seed) {
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

  function prepareSeedAdventure(seedId) {
    const seed = parcel.seeds.find((item) => item.id === seedId);
    if (!seed || !global.AdventureDraft) return;

    saveActiveSeed(seed);
    const draft = global.AdventureDraft.create({
      entry: { id: seed.id, title: seed.title, count: 9 },
      objective: seed.objective,
      bag: [
        `la Seed : ${seed.title}`,
        `l'objectif réel : ${seed.objective}`,
        `la première récolte attendue : ${seed.firstHarvest}`,
        "les créations, pages et ressources déjà disponibles dans l'écosystème Blacklace"
      ],
      picnic: [
        "Publisher pour préparer les Knowledge Packs utiles",
        "quelques tokens Mistral si une rédaction riche est nécessaire"
      ],
      grafts: ["Publisher Curator", "Mistral"],
      limits: [
        "Aucune publication ni prise de contact sans validation explicite",
        "Produire d'abord des livrables prêts à relire",
        "Privilégier une récolte concrète plutôt qu'un rapport abstrait",
        "Conserver toute piste, question et apprentissage au retour"
      ],
      note: `Parcelle 001 · ${parcel.name}. Première récolte visée : ${seed.firstHarvest}`
    });
    global.AdventureDraft.save(draft);
    state.adventureUrge = draft;
    pushChat("gerard", `🌱 J'ai choisi « ${seed.title} » dans la Parcelle 001. J'ai préparé un sac orienté vers une vraie première récolte. Je ne pars pas sans ta validation.`);
    render();
  }

  function icon(type) {
    return type === "book" ? "📚" : type === "game" ? "🎲" : type === "app" ? "📱" : "🌐";
  }

  function renderParcel() {
    const active = activeSeed();
    const seeds = parcel.seeds
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((seed) => `<article class="plan-item"><strong>${icon(seed.type)} ${esc(seed.title)}</strong><p>${esc(seed.objective)}</p><small>Première récolte : ${esc(seed.firstHarvest)}</small><div class="play-actions"><button class="${active?.seedId === seed.id ? "ghost" : "primary"}" data-blacklace-seed="${esc(seed.id)}">${active?.seedId === seed.id ? "🎒 Sac préparé" : "🌱 Confier à Gérard"}</button></div></article>`)
      .join("");

    return `<section class="blacklace-parcel"><p class="eyebrow">🌱 ${parcel.code}</p><h2>${esc(parcel.name)}</h2><p>${esc(parcel.mission)}</p><div class="plans">${seeds}</div><small>Priorité actuelle : obtenir des récoltes réelles, riches et utilisables rapidement.</small></section>`;
  }

  function bindParcelActions() {
    document.querySelectorAll("[data-blacklace-seed]").forEach((button) => {
      button.onclick = () => prepareSeedAdventure(button.dataset.blacklaceSeed);
    });
  }

  global.BlacklaceParcel = { PARCEL_ID, ACTIVE_SEED_KEY, parcel, activeSeed, prepareSeedAdventure, renderParcel };

  const baseRender = render;
  render = function renderWithBlacklaceParcel() {
    baseRender();
    if (state.step !== "objective") return;
    const existing = root.querySelector(".blacklace-parcel");
    if (!existing) root.insertAdjacentHTML("beforeend", renderParcel());
    bindParcelActions();
  };

  render();
})(globalThis);
