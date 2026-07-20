(function productKnowledgeModule(global) {
  "use strict";

  const packs = {
    "yael-prequalification-de-prospects": {
      version: 1,
      verified: true,
      source: "brief utilisateur validé pour la parcelle Yael Bali",
      title: "Yael Bali — Préqualification de prospects immobiliers",
      author: "Blacklace Publisher",
      format: "dossier opérationnel de prospection et de préqualification",
      synopsis: "Yael Bali exerce comme courtière en immobilier et souhaite obtenir localement un à deux prospects qualifiés par mois. La priorité est un outil de prospection simple, avec des listes exploitables, des messages de prise de contact et une préqualification prudente avant échange humain.",
      themes: [
        "prospection locale",
        "préqualification de prospects",
        "courtage immobilier",
        "prise de contact LinkedIn",
        "suivi commercial humain"
      ],
      tone: [
        "professionnel",
        "rassurant",
        "direct",
        "sans pression commerciale",
        "orienté aide concrète"
      ],
      recurringElements: [
        "besoin immobilier exprimé",
        "zone géographique",
        "calendrier du projet",
        "situation de financement à clarifier",
        "prochaine action humaine"
      ],
      audienceHypotheses: [
        "particuliers préparant un achat immobilier",
        "personnes cherchant à comprendre leur capacité de financement",
        "prospects locaux ayant besoin d'un accompagnement de courtage"
      ],
      knownFacts: [
        "Yael Bali est courtière en immobilier.",
        "L'objectif annoncé est d'obtenir un à deux prospects qualifiés par mois.",
        "La priorité est un outil prospecteur de clients et une liste de prospects locaux.",
        "Une campagne LinkedIn sur sept jours a été envisagée.",
        "Les livrables doivent être exploitables en texte, HTML ou liste, sans dépendre de Canva.",
        "Aucun taux, partenariat bancaire, zone exacte, témoignage client ou résultat commercial garanti n'est vérifié dans ce dossier."
      ],
      allowedClaims: [
        "accompagnement en courtage immobilier",
        "aide à clarifier un projet et ses prochaines étapes",
        "prise de contact locale et personnalisée",
        "préqualification avant échange avec Yael"
      ],
      forbiddenClaims: [
        "taux garanti",
        "acceptation de financement garantie",
        "meilleur taux du marché",
        "partenariat bancaire non fourni",
        "nombre de clients ou taux de réussite inventé",
        "urgence artificielle ou pression à répondre"
      ],
      campaignDirection: "Identifier des personnes exprimant un projet immobilier local, ouvrir une conversation utile et non intrusive, poser quelques questions de contexte, puis proposer un échange humain avec Yael lorsque le besoin paraît réel.",
      sampleAngles: [
        "Vous préparez un achat immobilier et vous ne savez pas encore par où commencer côté financement ?",
        "Avant de comparer des taux, quelques informations simples permettent déjà de clarifier un projet.",
        "Un premier échange peut servir à vérifier où en est réellement votre projet, sans engagement."
      ]
    },
    "gerard-et-gerard": {
      version: 1,
      verified: true,
      source: "Gerard_et_Gerard_KDP_Final",
      title: "Gérard & Gérard — Brèves histoires d'une simulation oubliée",
      author: "Benoît Lubert",
      format: "comédie cosmique et fable philosophique",
      synopsis: "Deux vieux Poulstroïdes, tous deux prénommés Gérard, retrouvent par hasard une simulation oubliée de l'humanité. En observant nos croissants, nos animaux, nos voitures, nos salles de sport, nos assistants numériques et nos contradictions, ils comprennent souvent tout de travers — mais regardent peu à peu les humains avec une tendresse émerveillée.",
      themes: ["amitié ancienne et tendre", "regard extraterrestre sur les absurdités humaines", "technologie et mémoire", "contradictions de l'humanité", "mélancolie, émerveillement et espoir"],
      tone: ["drôle sans être cynique", "tendre", "absurde", "philosophique sans donner de leçon", "mélancolique et lumineux"],
      recurringElements: ["le Frunch", "les contresens des deux Gérard", "les deux choses à la fois", "Ils étaient vraiment extraordinaires", "Ils continuaient toujours à espérer"],
      audienceHypotheses: ["lecteurs de comédie SF douce", "lecteurs appréciant Douglas Adams ou Terry Pratchett sans imitation de style", "public sensible aux fables sur la technologie et l'humanité", "lecteurs recherchant humour, tendresse et réflexion"],
      knownFacts: ["Le livre est vendu sur Amazon.", "Le prix indiqué par le créateur est 20 €.", "Les protagonistes ne sont ni des coachs ni des experts en productivité.", "Le livre ne promet aucune méthode, template, transformation en 24 h ou garantie commerciale.", "Aucun chiffre de ventes, nombre de lecteurs, témoignage d'influenceur, bonus ou remise n'est vérifié."],
      allowedClaims: ["comédie cosmique", "deux extraterrestres observent une simulation oubliée de l'humanité", "humour, tendresse philosophique, absurdité quotidienne et mélancolie", "un livre sur l'amitié, les souvenirs imparfaits et l'espoir humain"],
      forbiddenClaims: ["méthode révolutionnaire", "guide pratique", "20 ans d'expérience condensés", "résultats garantis", "50 000 lecteurs", "témoignages ou preuves sociales non fournies", "offre limitée ou retrait prochain des ventes", "prix barré, bonus, livraison gratuite ou remboursement non vérifiés", "photo des auteurs comme duo de personnages"],
      campaignDirection: "Donner envie d'ouvrir le hublot avec les deux Gérard : partir d'une question étrange sur les humains, montrer un contresens drôle ou une phrase tendre, puis inviter à découvrir la comédie cosmique sur Amazon.",
      sampleAngles: ["Et si deux extraterrestres essayaient de comprendre pourquoi les humains courent sur des tapis qui ne vont nulle part ?", "Les humains ont brûlé leur monde pour le traverser plus vite — mais ils ont aussi chanté dans leurs voitures.", "Et si notre univers était une vieille simulation oubliée, retrouvée par deux Gérard avec du Frunch ?"]
    },
    "terra": {
      version: 1,
      verified: true,
      source: "TERRA manuscript and validated editorial decisions",
      title: "TERRA — Un récit d'observation, une fable cosmique",
      author: "Benoît Lubert",
      format: "fable cosmique, récit d'observation et science-fiction contemplative",
      synopsis: "À travers plusieurs époques et plusieurs regards humains, une présence observe la Terre, ses catastrophes, ses guerres, ses centrales, ses volcans et ses gestes ordinaires. Séïne, sa grand-mère Lysse, Park Ji-woo, Frère Anselme, le lieutenant Harwick et d'autres témoins forment une mosaïque où une sonde verte et des lectures temporelles interrogent ce que l'humanité comprend — ou refuse de comprendre — de sa propre planète.",
      themes: ["observation de l'humanité à travers le temps", "mémoire, transmission et perception", "rapport entre phénomènes cosmiques et vies ordinaires", "fragilité de la Terre et persistance humaine", "disclosure, signes ambigus et interprétation"],
      tone: ["contemplatif", "mystérieux", "humain et sensible", "cosmique sans grandiloquence", "philosophique sans sermon écologique"],
      recurringElements: ["la sonde verte", "les lectures temporelles", "les apparitions près des volcans, centrales et conflits", "la vaisselle de la grand-mère", "les scènes de Lyon 2009", "le disclosure day"],
      audienceHypotheses: ["lecteurs de science-fiction contemplative", "lecteurs de récits mosaïques et de fables philosophiques", "public attiré par les mystères cosmiques, les observations temporelles et les récits humains", "lecteurs sensibles à une réflexion sur la Terre sans discours militant simplificateur"],
      knownFacts: ["Le sous-titre validé est : Un récit d'observation, une fable cosmique.", "Le livre n'est pas présenté comme un thriller écologique ni comme un manuel d'action climatique.", "Le récit traverse plusieurs périodes historiques et plusieurs personnages.", "Séïne, Lysse, Park Ji-woo, Frère Anselme et le lieutenant Harwick font partie des personnages connus.", "Aucun témoignage de lecteur, média, influenceur, chiffre de vente, prix littéraire ou citation critique n'est vérifié.", "Aucun extrait inventé ne doit être attribué au manuscrit."],
      allowedClaims: ["fable cosmique", "récit d'observation à travers plusieurs époques", "mosaïque de vies humaines confrontées à des signes difficiles à interpréter", "science-fiction contemplative sur la Terre, la mémoire et la perception"],
      forbiddenClaims: ["thriller écologique", "roman d'effondrement haletant", "fin du monde imminente", "appel militant à agir pour le climat", "comparaison affirmée à Mad Max, La Route, Les Furtifs ou Parable of the Sower", "scène d'effondrement d'une ville non fournie", "citation critique ou scène culte inventée", "témoignage, preuve sociale, compte Instagram, podcast ou média présenté comme acquis sans vérification"],
      campaignDirection: "Présenter TERRA comme une invitation à regarder notre planète depuis un point de vue plus vaste : partir d'un signe, d'une époque ou d'un geste humain minuscule, puis ouvrir sur la question de ce qu'une présence extérieure pourrait comprendre de nous.",
      sampleAngles: ["Et si quelqu'un observait la Terre depuis des siècles sans jamais être certain de ce qu'il voyait ?", "Une sonde verte apparaît près de nos volcans, de nos guerres et de nos centrales. Elle ne juge pas. Elle regarde.", "TERRA ne raconte pas la fin du monde. Elle demande ce qu'il reste visible de nous quand on nous observe de très loin."]
    }
  };

  function get(seedId) { return packs[seedId] || null; }

  function toPrompt(pack) {
    if (!pack?.verified) return "";
    return [
      "DOSSIER PRODUIT VÉRIFIÉ — SOURCE DE VÉRITÉ",
      `Titre: ${pack.title}`,
      `Auteur: ${pack.author}`,
      `Nature: ${pack.format}`,
      `Synopsis: ${pack.synopsis}`,
      `Thèmes: ${pack.themes.join(" | ")}`,
      `Ton: ${pack.tone.join(" | ")}`,
      `Éléments récurrents: ${pack.recurringElements.join(" | ")}`,
      `Publics possibles (hypothèses, pas faits): ${pack.audienceHypotheses.join(" | ")}`,
      `Faits connus: ${pack.knownFacts.join(" | ")}`,
      `Promesses autorisées: ${pack.allowedClaims.join(" | ")}`,
      `Allégations interdites: ${pack.forbiddenClaims.join(" | ")}`,
      `Direction de campagne: ${pack.campaignDirection}`,
      `Angles possibles: ${pack.sampleAngles.join(" | ")}`,
      "RÈGLE: n'ajoute aucun chiffre, témoignage, urgence, bonus, avantage, caractéristique, extrait ou lien non présent dans ce dossier.",
      "RÈGLE: lorsqu'une information commerciale manque, formule une question explicite au lieu de la compléter.",
      "RÈGLE: toute sortie doit rester fidèle à la nature, au ton et aux thèmes du produit."
    ].join("\n");
  }

  global.ProductKnowledge = { packs, get, toPrompt };
})(globalThis);