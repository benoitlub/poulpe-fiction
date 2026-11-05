const PROJECTS = [
  ["terra", /\bterra\b/, /\bterra\b|solaris|three[ -]body problem/, "Comparer une ouverture sur le témoin à une ouverture sur le phénomène."],
  ["gerard-et-gerard", /gerard (?:et |& )?gerard|gerard-et-gerard/, /gerard & gerard|hitchhiker|going postal|discworld/, "Mettre deux interprétations du même détail en tension, puis laisser respirer la chute."],
  ["neverland-ltd", /neverland/, /neverland|peter pan/, "Partir d’un détail familier et révéler un écart propre au tome choisi."],
  ["feulette-tachetee", /feulette/, /feulette|stinky cheese man/, "Faire chercher un détail avant de le révéler. Garder la tache comme point d’entrée."],
  ["crotte-de-nez-magique", /crotte de nez|crotte-de-nez/, /crotte de nez|book with no pictures|stinky cheese man/, "Installer une attente très sérieuse et la déjouer par une chute absurde."],
  ["vacances-interdites", /vacances interdites|vacances-interdites/, /vacances interdites|amari|wrinkle in time/, "Montrer un instant banal puis un seul détail qui fait basculer la scène."],
  ["ilvaard", /ilvaard/, /ilvaard|\bdune\b|worldbuilding|petit prince/, "Faire comprendre une règle de l’univers par sa conséquence dans une scène."],
  ["ema", /\bema\b|re[ -]flute/, /\bema\b|re[ -]flute|avenue 5|futurama/, "Comparer un début sur la consigne à un début sur la réaction qu’elle provoque."],
  ["grammaire-du-reel", /grammaire du reel|grammaire-du-reel/, /grammaire du reel|m[oœ]bius/, "Présenter une même phrase dans deux contextes et faire entendre le changement de sens."],
  ["420-dice", /420[ -]dice|blacklace[ -]dice|feuch[ -]dice/, /dicey dungeons|slice & dice/, "Sur une vraie séquence de jeu, comparer un début par le lancer à un début par le choix."],
  ["jointed", /jointed/, /balatro/, "Montrer une vraie association de cartes, puis sa conséquence avant de conclure."],
  ["prohibited-online", /pro[.\s-]?hibited|prout[.\s-]?hibited|feuch[ -]game/, /dobble|tapple|taco cat|exploding kittens/, "Faire participer le spectateur à un choix ou ouvrir sur une réaction réelle."],
  ["blacklace-island", /blacklace[ -]island/, /ilvaard|dune|worldbuilding/, "Faire découvrir le monde par un élément visible et la décision qu’il provoque."],
];

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function parseReference(row) {
  if (row?.kind !== "video" || row.category !== "creative-benchmark" ||
      !Array.isArray(row.tags) || !row.tags.includes("veille-concurrentielle") ||
      typeof row.summary !== "string") return null;
  const videoId = /^gerard-competitive-youtube-([A-Za-z0-9_-]{11})$/.exec(row.id ?? "")?.[1];
  if (!videoId || row.value !== "https://www.youtube.com/watch?v=" + videoId) return null;
  const measured = /YouTube public : (\d{1,12}) vues relevées le (\d{4}-\d{2}-\d{2}), durée (\d{1,2}:\d{2})/.exec(row.summary);
  if (!measured) return null;
  return {
    id: row.id, url: row.value, views: Number(measured[1]), measuredAt: measured[2], duration: measured[3],
    subjects: normalize([row.name, ...row.tags].join(" ")),
  };
}

export async function loadCreativeBenchmarks(subjects) {
  const projectText = normalize(subjects.join(" "));
  const relevant = PROJECTS.filter(([, project]) => project.test(projectText)).slice(0, 3);
  if (!relevant.length) return [];
  const base = (process.env.PUBLISHER_URL || "https://blacklace-publisher-worker.benoitlubert.workers.dev").replace(/\/$/, "");
  const projects = relevant.map(([project]) => project);
  try {
    const response = await fetch(base + "/api/observatory/sources?limit=200", { signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error("publisher-http-" + response.status);
    const payload = await response.json();
    if (!payload.configured || !Array.isArray(payload.sources)) throw new Error("publisher-sources-unavailable");
    const rows = payload.sources.map(parseReference).filter(Boolean);
    const references = [];
    for (const [project, , subject, experiment] of relevant) {
      const match = rows.filter(row => subject.test(row.subjects) && !references.some(item => item.id === row.id))
        .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt) || b.views - a.views || a.id.localeCompare(b.id))[0];
      if (match) {
        const { subjects: _subjects, ...reference } = match;
        references.push({ ...reference, project, experiment });
      }
    }
    console.log(JSON.stringify({ event: "gerard.creative-benchmarks", status: references.length ? "loaded" : "no-match",
      projects, references: references.map(({ id, project }) => ({ id, project })) }));
    return references;
  } catch {
    console.log(JSON.stringify({ event: "gerard.creative-benchmarks", status: "unavailable", projects }));
    return [];
  }
}

export function creativeBenchmarkPrompt(references) {
  if (!references.length) return [];
  return [
    "Pistes facultatives issues de la veille Publisher. Les vues sont des observations publiques, jamais une preuve d’efficacité ni des faits sur le projet.",
    "Si cela aide le livrable, adapte une seule mécanique à un contenu original. N’insère ni référence, ni chiffre concurrent, ni commentaire de travail dans le texte public.",
    ...references.map(ref => ref.project + " · " + ref.views + " vues le " + ref.measuredAt + " · " + ref.duration + " · " + ref.experiment),
  ];
}
