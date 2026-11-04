const ROLE_TERMS = [
  "formateur multimédia", "formateur numérique", "formateur digital",
  "AI image designer", "AI creative", "generative AI designer",
  "designer créatif digital", "directeur artistique digital",
  "creative designer", "multimedia trainer",
];
const PROFILE_TERMS = [
  "multimedia training", "digital training", "Photoshop", "creative design",
  "children animation", "sales", "AI image generation", "generative AI",
];

export function buildJobSearchQuery({ location = "France", remote = true } = {}) {
  const roles = ROLE_TERMS.map(term => `"${term}"`).join(" OR ");
  return `site:linkedin.com/jobs/view (${roles}) (${location}${remote ? " OR remote OR télétravail" : ""})`;
}

export function rankJobCandidates(candidates = [], limit = 8) {
  const seen = new Set();
  return candidates.flatMap(candidate => {
    if (!candidate || typeof candidate.url !== "string" || typeof candidate.title !== "string") return [];
    let url;
    try { url = new URL(candidate.url); } catch { return []; }
    if (!["linkedin.com", "www.linkedin.com", "fr.linkedin.com"].includes(url.hostname)) return [];
    const key = url.origin + url.pathname.replace(/\/$/, "");
    if (seen.has(key)) return [];
    seen.add(key);
    const evidence = `${candidate.title} ${candidate.snippet || ""}`.toLowerCase();
    const matchedRoles = ROLE_TERMS.filter(term => evidence.includes(term.toLowerCase()));
    const matchedSkills = PROFILE_TERMS.filter(term => evidence.includes(term.toLowerCase()));
    const fitScore = Math.min(100, matchedRoles.length * 25 + matchedSkills.length * 10);
    return [{
      title: candidate.title.slice(0, 250),
      url: url.href,
      snippet: String(candidate.snippet || "").slice(0, 1200),
      verification: "search-result-only",
      qualification: fitScore >= 40 ? "priority-review" : "investigate",
      fitScore,
      matchedRoles,
      matchedSkills,
      evidence: String(candidate.snippet || "").slice(0, 500),
      contactEmail: null,
      contacted: false,
      nextAction: "Ouvrir l’annonce, vérifier qu’elle est toujours active et confirmer les critères avant toute candidature.",
    }];
  }).sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);
}

export function formatJobSearchContext(jobs = [], profile = {}) {
  const verifiedProfile = [
    "20 ans de formation multimédia",
    "7 ans d’animation auprès d’enfants",
    "2 ans d’expérience commerciale",
    "certificat Adobe Photoshop",
    "anglais B2+",
    "8 ans de vie en Espagne; espagnol à réactiver et niveau à vérifier",
  ];
  return [
    "Profil candidat connu (ne rien inventer) :",
    ...verifiedProfile.map(item => `- ${item}`),
    "",
    "Annonces trouvées (résultats de recherche, à vérifier; aucune annonce n’est réputée active sans ouverture de page) :",
    ...jobs.map((job, index) => [
      `${index + 1}. ${job.title} — adéquation indicative ${job.fitScore}/100`,
      `URL : ${job.url}`,
      `Indices de correspondance : ${[...job.matchedRoles, ...job.matchedSkills].join(", ") || "aucun terme précis"}`,
      `Extrait : ${job.snippet || "aucun extrait"}`,
    ].join("\n")),
    "",
    "Consigne : retenir au maximum les trois annonces les plus crédibles, expliquer les écarts et préparer pour chacune un brouillon de réponse/candidature adapté au profil. Ne pas inventer d’expérience, de diplôme, de résultat chiffré, de disponibilité ou de motivation personnelle. Indiquer les éléments à confirmer. Ne jamais envoyer la réponse.",
  ].join("\n");
}
