(function feuletteKnowledgeModule(global) {
  "use strict";
  const knowledge = global.ProductKnowledge;
  if (!knowledge?.packs) return;

  knowledge.packs["feulette-tachetee"] = {
    version: 1,
    verified: true,
    source: "Auteur, catalogue Blacklace et références KDP validées",
    title: "La Feulette Tachetée",
    author: "Benoît Lubert",
    format: "fable satirique sur l’influence émotionnelle",
    synopsis: "Le dossier local ne contient pas encore le synopsis intégral. Toute présentation doit rester limitée aux faits connus et demander les éléments narratifs manquants plutôt que les inventer.",
    themes: [
      "influence émotionnelle",
      "fable satirique",
      "imaginaire et étrangeté douce"
    ],
    tone: [
      "satirique",
      "poétique",
      "étrange sans être agressif"
    ],
    recurringElements: [
      "la Feulette Tachetée",
      "les mécanismes d’influence émotionnelle"
    ],
    audienceHypotheses: [
      "lecteurs de fables satiriques",
      "lecteurs attirés par les récits mêlant poésie, étrangeté et réflexion"
    ],
    knownFacts: [
      "Le titre est La Feulette Tachetée.",
      "L’auteur est Benoît Lubert.",
      "Le livre est présenté comme une fable satirique sur l’influence émotionnelle.",
      "Le livre est disponible sur Amazon sous l’ASIN B0GYSSLZX4.",
      "Le synopsis détaillé, les personnages et les extraits ne sont pas présents dans ce fallback."
    ],
    allowedClaims: [
      "fable satirique sur l’influence émotionnelle",
      "récit de Benoît Lubert",
      "univers poétique et étrange"
    ],
    forbiddenClaims: [
      "synopsis inventé",
      "personnages ou scènes non fournis",
      "témoignages, ventes ou récompenses non vérifiés",
      "promesses thérapeutiques ou psychologiques",
      "urgence commerciale, remise ou bonus non vérifié"
    ],
    campaignDirection: "Préparer une première présentation honnête centrée sur la notion de fable satirique et d’influence émotionnelle, puis signaler clairement les informations narratives à récupérer avant une campagne plus riche.",
    sampleAngles: [
      "Et si nos émotions étaient moins personnelles qu’on ne le croit ?",
      "Une fable satirique sur ce qui nous influence avant même que nous en ayons conscience."
    ]
  };
})(globalThis);
