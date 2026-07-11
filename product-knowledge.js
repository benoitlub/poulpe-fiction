(function productKnowledgeModule(global) {
  "use strict";

  const packs = {
    "gerard-et-gerard": {
      version: 1,
      verified: true,
      source: "Gerard_et_Gerard_KDP_Final",
      title: "Gérard & Gérard — Brèves histoires d'une simulation oubliée",
      author: "Benoît Lubert",
      format: "comédie cosmique et fable philosophique",
      synopsis: "Deux vieux Poulstroïdes, tous deux prénommés Gérard, retrouvent par hasard une simulation oubliée de l'humanité. En observant nos croissants, nos animaux, nos voitures, nos salles de sport, nos assistants numériques et nos contradictions, ils comprennent souvent tout de travers — mais regardent peu à peu les humains avec une tendresse émerveillée.",
      themes: [
        "amitié ancienne et tendre",
        "regard extraterrestre sur les absurdités humaines",
        "technologie et mémoire",
        "contradictions de l'humanité",
        "mélancolie, émerveillement et espoir"
      ],
      tone: [
        "drôle sans être cynique",
        "tendre",
        "absurde",
        "philosophique sans donner de leçon",
        "mélancolique et lumineux"
      ],
      recurringElements: [
        "le Frunch",
        "les contresens des deux Gérard",
        "les deux choses à la fois",
        "Ils étaient vraiment extraordinaires",
        "Ils continuaient toujours à espérer"
      ],
      audienceHypotheses: [
        "lecteurs de comédie SF douce",
        "lecteurs appréciant Douglas Adams ou Terry Pratchett sans imitation de style",
        "public sensible aux fables sur la technologie et l'humanité",
        "lecteurs recherchant humour, tendresse et réflexion"
      ],
      knownFacts: [
        "Le livre est vendu sur Amazon.",
        "Le prix indiqué par le créateur est 20 €.",
        "Les protagonistes ne sont ni des coachs ni des experts en productivité.",
        "Le livre ne promet aucune méthode, template, transformation en 24 h ou garantie commerciale.",
        "Aucun chiffre de ventes, nombre de lecteurs, témoignage d'influenceur, bonus ou remise n'est vérifié."
      ],
      allowedClaims: [
        "comédie cosmique",
        "deux extraterrestres observent une simulation oubliée de l'humanité",
        "humour, tendresse philosophique, absurdité quotidienne et mélancolie",
        "un livre sur l'amitié, les souvenirs imparfaits et l'espoir humain"
      ],
      forbiddenClaims: [
        "méthode révolutionnaire",
        "guide pratique",
        "20 ans d'expérience condensés",
        "résultats garantis",
        "50 000 lecteurs",
        "témoignages ou preuves sociales non fournies",
        "offre limitée ou retrait prochain des ventes",
        "prix barré, bonus, livraison gratuite ou remboursement non vérifiés",
        "photo des auteurs comme duo de personnages"
      ],
      campaignDirection: "Donner envie d'ouvrir le hublot avec les deux Gérard : partir d'une question étrange sur les humains, montrer un contresens drôle ou une phrase tendre, puis inviter à découvrir la comédie cosmique sur Amazon.",
      sampleAngles: [
        "Et si deux extraterrestres essayaient de comprendre pourquoi les humains courent sur des tapis qui ne vont nulle part ?",
        "Les humains ont brûlé leur monde pour le traverser plus vite — mais ils ont aussi chanté dans leurs voitures.",
        "Et si notre univers était une vieille simulation oubliée, retrouvée par deux Gérard avec du Frunch ?"
      ]
    }
  };

  function get(seedId) {
    return packs[seedId] || null;
  }

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
      "RÈGLE: n'ajoute aucun chiffre, témoignage, urgence, bonus, avantage, caractéristique ou lien non présent dans ce dossier.",
      "RÈGLE: lorsqu'une information commerciale manque, formule une question explicite au lieu de la compléter.",
      "RÈGLE: toute sortie doit être fidèle au livre, à son humour tendre et à sa dimension philosophique."
    ].join("\n");
  }

  global.ProductKnowledge = { packs, get, toPrompt };
})(globalThis);
