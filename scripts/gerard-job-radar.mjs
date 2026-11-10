import { createHash } from "node:crypto";

const sources = "(site:candidat.francetravail.fr/offres/recherche/detail OR site:hellowork.com/fr-fr/emplois OR site:welcometothejungle.com/fr/companies)";
export const jobSearchQueries = [
  `${sources} ("conseiller de vente" OR "vendeur" OR "vendeuse") (Versailles OR "La Celle-Saint-Cloud" OR "Le Chesnay" OR "Rueil-Malmaison" OR "Saint-Germain-en-Laye" OR "Marly-le-Roi")`,
  `${sources} ("formateur multimédia" OR "formateur numérique" OR "graphiste" OR "AI image designer" OR "automatisation IA") (Yvelines OR "Île-de-France" OR télétravail)`,
];

const local = /\b(?:78000|78150|78170|78160|78380|78430|78400|78600|78100|92420|92500|versailles|le chesnay|la celle.saint.cloud|louveciennes|marly.le.roi|rueil.malmaison|saint.germain.en.laye|bougival|vaucresson)\b/i;
const employment = /\b(?:CDI|CDD|FULL_TIME|PART_TIME|TEMPORARY|PERMANENT|salariat|intérim)\b/i;
const independent = /\b(?:freelance|indépendant|CONTRACTOR|auto.entrepreneur|micro.entreprise|independant)\b/i;
const contingentPay = /(?:sans|aucune)\s+rémunération|(?:fixez|fixer|définissez|définir)\s+(?:vous.même\s+)?(?:vos|vos propres|ses|les)\s+tarifs|rémunération\s+(?:uniquement|exclusivement)\s+(?:à la commission|selon les inscriptions)|bénévolat|commission uniquement|100\s*%\s+commission/i;

const profiles = [
  { role: /\b(?:vendeu[rs]|vendeuse|vente|boutique)\b/i, evidence: "J’ai deux ans d’expérience commerciale, dont une expérience récente en boutique chez Alter Smoke." },
  { role: /\b(?:formateu[rs]|formatrice|formation|multimédia)\b/i, evidence: "J’ai travaillé vingt ans comme formateur en multimédia et j’ai l’habitude d’accompagner des publics de niveaux différents." },
  { role: /\b(?:graphiste|designer|créati(?:on|f|ve) visuel|infographiste)\b/i, evidence: "Mon parcours mêle vingt ans de formation en multimédia et la création de visuels. Je suis titulaire d’un certificat Adobe Photoshop." },
  { role: /\b(?:automatisation|automation|agents? ia|workflow|no.code)\b/i, evidence: "J’ai conçu Poulpe Fiction, un projet qui assemble des outils d’IA et automatise des étapes de production de contenus." },
];

export function rankJobCandidates(candidates, limit = 3) {
  const seen = new Set();
  return candidates.flatMap(job => {
    if (job.verification !== "source-opened" || !job.title || !job.employer) return [];
    const description = job.snippet || "";
    const profile = profiles.find(item => item.role.test(job.title));
    if (!profile || contingentPay.test(description)) return [];
    const nearby = local.test(job.location || "");
    const isIndependent = independent.test(`${job.employmentType} ${job.title}`);
    const salaried = !isIndependent && (employment.test(job.employmentType || "") ||
      /\b(?:contrat (?:en )?(?:CDI|CDD)|poste en (?:CDI|CDD))\b/i.test(description));
    const freelance = isIndependent && Boolean(job.salary);
    if ((!nearby && !job.remote) || (!salaried && !freelance)) return [];
    const url = URL.canParse(job.url) ? new URL(job.url) : null;
    if (url?.protocol !== "https:" || url.username || url.password) return [];
    const identity = [job.employer, job.title, job.location || (job.remote ? "remote" : "")].join(" ")
      .normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const id = "candidature-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);
    if (seen.has(id)) return [];
    seen.add(id);
    const salary = job.salary || "Montant non indiqué dans les données vérifiées";
    const type = (job.employmentType || (salaried ? "Salarié" : "Mission rémunérée"))
      .replaceAll("FULL_TIME", "Temps plein").replaceAll("PART_TIME", "Temps partiel")
      .replaceAll("CONTRACTOR", "Indépendant").replaceAll("TEMPORARY", "Temporaire");
    const channel = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(job.applicationEmail || "") ? `Destinataire vérifié dans l’annonce : ${job.applicationEmail}`
      : "Candidature via la page de l’annonce. Aucun e-mail de candidature vérifié.";
    const subject = `Candidature · ${job.title}`;
    return [{
      id, title: `${job.title} · ${job.employer}`,
      score: (salaried && nearby ? 8 : 0) + (salaried ? 2 : 0) + (nearby ? 1 : 0) + (job.salary ? 1 : 0),
      content: [
        "### Offre vérifiée par Publisher",
        `[Ouvrir l’annonce d’origine](${url.href})`,
        `- Contrat : ${type}`,
        `- Lieu : ${job.location || "Télétravail"}${job.location && job.remote ? " · télétravail" : ""}`,
        ...(job.hours ? [`- Horaires : ${job.hours}`] : []),
        `- Rémunération : ${salary}`,
        `- ${channel}`,
        `- CV : ${profile === profiles[0] ? "CV_Benoit_Lubert_Vente_2026.pdf à joindre" : "version adaptée au poste à sélectionner avant envoi"}.`,
        "",
        "### Brouillon de candidature",
        `Objet : ${subject}`,
        "",
        "Bonjour,",
        "",
        `Je vous contacte au sujet de votre offre de ${job.title}. ${profile.evidence}`,
        "",
        "Je serais disponible pour échanger sur vos besoins et vous présenter mon parcours.",
        "",
        "Bien cordialement,",
        "Benoît Lubert",
      ].join("\n"),
    }];
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}
