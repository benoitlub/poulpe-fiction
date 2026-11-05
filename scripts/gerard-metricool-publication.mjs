import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { creativeBenchmarkPrompt, loadCreativeBenchmarks } from "./gerard-creative-benchmarks.mjs";

export function metricoolMission(candidate, { execute = false, now = new Date() } = {}) {
  if (candidate?.status !== "ready" || candidate?.transport?.provider !== "metricool" ||
      candidate?.editorialRoute?.destination?.preferredProvider !== "metricool" ||
      candidate?.action === "do-not-schedule") return null;
  const harvestId = typeof candidate.harvestId === "string" ? candidate.harvestId.trim() : "";
  const text = typeof candidate.copy?.text === "string" ? candidate.copy.text : "";
  const media = candidate.media?.url ? [candidate.media.url] : [];
  const allowed = media.length ? ["facebook", "instagram", "tiktok"] : ["facebook"];
  // Respect the networks supplied by the media/selection capability. Do not
  // quietly add Instagram to a Facebook-only decision because a URL exists.
  const networks = [...new Set(candidate.compatibleNetworks ?? [])];
  if (networks.some(n => !allowed.includes(n))) return null;
  // TikTok requires a video asset and the explicit Blacklace destination.
  // A generic image URL or an inferred account is never sufficient.
  if (networks.includes("tiktok") && (!candidate.media?.url || !/\.mp4(?:[?#]|$)/i.test(candidate.media.url) ||
      String(candidate.transport?.brandId ?? "") !== "7653100" || networks.length !== 1)) return null;
  if (!harvestId || !networks.length || (!text.trim() && !media.length)) return null;
  const stable = createHash("sha256").update(JSON.stringify([harvestId, text, media, [...networks].sort()])).digest("hex");
  const operationId = `gerard-metricool-${stable}`;
  return {
    // Octopus traces each check; the publication operation key stays identical
    // across retries, status checks and cron restarts.
    operationId: `${operationId}-${now.getTime()}`,
    title: `Programmer la récolte ${harvestId}`,
    objective: "Exécuter la décision de Gérard avec quota réel, dédoublonnage et confirmation Metricool.",
    requiredCapabilities: ["social.publish"], authorizedResources: ["social.publish"],
    context: { id: "poulpe-fiction", label: "Gérard", metadata: { source: "gerard-cycle", socialPublication: {
      operationId, harvestId, mediaHarvestId: candidate.media?.sourceHarvestId ?? harvestId,
      seedId: candidate.seedId, text, media, networks,
      source: "gerard", decision: "schedule", dryRun: !execute,
    } } },
  };
}

export function bufferMission(candidate, { execute = false, now = new Date() } = {}) {
  if (candidate?.status !== "ready" || candidate?.transport?.provider !== "buffer" ||
      candidate?.editorialRoute?.destination?.preferredProvider !== "buffer" || candidate?.action === "do-not-schedule") return null;
  const channelId = candidate.transport.channelId;
  const harvestId = candidate.harvestId;
  const text = candidate.copy?.text;
  const media = candidate.media?.url ? [candidate.media.url] : [];
  // The destination is Gerard's explicit decision, not inferred from a handle.
  if (!channelId || !harvestId || typeof text !== "string" || !text.trim() || media.length !== 1 ||
      !Array.isArray(candidate.compatibleNetworks) || candidate.compatibleNetworks.length !== 1 || candidate.compatibleNetworks[0] !== "instagram") return null;
  const stable = createHash("sha256").update(JSON.stringify([harvestId, channelId, text, media])).digest("hex");
  const operationId = `gerard-buffer-${stable}`;
  return { operationId: `${operationId}-${now.getTime()}`, title: `Programmer la récolte ${harvestId}`,
    objective: "Exécuter la décision Buffer de Gérard, du brouillon au statut confirmé, sans remplacement du transport.",
    requiredCapabilities: ["social.publish"], authorizedResources: ["social.publish"],
    context: { id: "poulpe-fiction", label: "Gérard", metadata: { source: "gerard-cycle", socialPublication: {
      operationId, transport: "buffer", harvestId, mediaHarvestId: candidate.media.sourceHarvestId ?? harvestId,
      text, media, networks: ["instagram"], channelId, source: "gerard", decision: "schedule", dryRun: !execute,
    } } } };
}

async function submitPublication(candidate, mission, handoffKey, options) {
  if (!mission) return candidate;
  let outcome;
  try {
    const response = await (options.fetchImpl ?? fetch)(`${(options.octopusUrl ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/mission`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mission), signal: AbortSignal.timeout(120000),
    });
    const body = await response.json();
    const output = body?.output;
    if (!response.ok || !output || typeof output !== "object") throw new Error("Unconfirmed Octopus response");
    // A completed mission, an accepted request or a returned ID alone does not
    // establish a scheduled publication. Require the provider-confirmed state.
    const scheduled = body.status === "completed" && output.status === "confirmed-scheduled" && output.scheduled === true && Boolean(output.postId);
    const published = body.status === "completed" && output.status === "confirmed-published" && output.published === true && Boolean(output.postId);
    outcome = {
      status: scheduled ? "confirmed-scheduled" : published ? "confirmed-published" : String(output.status ?? body.status ?? "unconfirmed"),
      stage: output.stage ?? "octopus", reason: output.reason ?? null,
      operationId: mission.context.metadata.socialPublication.operationId, missionId: mission.operationId,
      postId: output.postId ?? null, publicationDate: output.publicationDate ?? null,
      retryAfterSeconds: output.retryAfterSeconds ?? null, budget: output.budget ?? null, scheduled, published,
    };
  } catch {
    outcome = { status: "confirmation-required", stage: "octopus-transport", reason: "OCTOPUS_RESPONSE_UNCONFIRMED",
      operationId: mission.context.metadata.socialPublication.operationId, missionId: mission.operationId, scheduled: false, published: false };
  }
  return { ...candidate, [handoffKey]: outcome,
    delivery: { status: outcome.status, publishingEnabled: outcome.scheduled || outcome.published, stage: outcome.stage, reason: outcome.reason } };
}

export async function submitMetricoolPublication(candidate, options = {}) {
  return submitPublication(candidate, metricoolMission(candidate, options), "metricoolHandoff", options);
}

// Opt-in API only: the existing cron and its Buffer recovery circuit are unchanged.
export async function submitBufferPublication(candidate, options = {}) {
  return submitPublication(candidate, bufferMission(candidate, options), "bufferHandoff", options);
}

const MAIL_RECIPIENT = "benoitlubert@gmail.com";
const MAIL_SUBJECT = "[Gerard Metricool v1]";

async function handoffMetricoolByEmail(candidate) {
  const mission = metricoolMission(candidate);
  if (!mission) return candidate;
  const { operationId, harvestId, seedId, text, media, networks } = mission.context.metadata.socialPublication;
  if (!seedId) return candidate;
  const brandId = networks.includes("tiktok") ? "7653100" : "3350145";
  if (candidate.transport.brandId && String(candidate.transport.brandId) !== brandId) return candidate;
  // The 420 Dice video revision is for review, including when selected for Facebook.
  if (media.length && /420[^a-z0-9]*dice/i.test([seedId, candidate.title, ...media].join(" "))) return candidate;
  const subject = MAIL_SUBJECT + " " + operationId;
  const body = JSON.stringify({ contract: "gerard-metricool-mail-v1", operationId, harvestId, seedId, brandId, networks, text, media });
  let outcome = { status: "mail-unconfirmed", operationId };
  try {
    const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
    url.searchParams.set("audience", "blacklace-publisher-gerard-owner-test");
    const tokenResponse = await fetch(url, {
      headers: { Authorization: "Bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN },
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new Error("github-oidc-unavailable");
    const { value } = await tokenResponse.json();
    if (!value) throw new Error("github-oidc-empty");
    const publisher = (process.env.PUBLISHER_URL || "https://blacklace-publisher-worker.benoitlubert.workers.dev").replace(/\/$/, "");
    const response = await fetch(publisher + "/api/gerard/gmail/send", {
      method: "POST",
      headers: { Authorization: "Bearer " + value, "Content-Type": "application/json" },
      body: JSON.stringify({
        operationId: "gerard-mail-" + operationId.slice("gerard-metricool-".length),
        recipientEmail: MAIL_RECIPIENT, subject, body,
      }),
      signal: AbortSignal.timeout(90000),
    });
    const result = await response.json();
    if (response.ok && result.status === "sent") outcome.status = "mail-sent";
    else if (result.reason === "operation-already-reserved") outcome.status = "mail-already-reserved";
    else outcome.reason = String(result.reason || result.status || response.status).slice(0, 100);
  } catch {
    outcome.reason = "mail-transport-unconfirmed";
  }
  return { ...candidate, metricoolHandoff: outcome,
    delivery: { status: outcome.status, publishingEnabled: false, stage: "gmail-relay", reason: outcome.reason ?? null } };
}

// Local captions are deliberately phrased as prompts to the community.
// They require no provider, media, or unverified claims about the project.
const FACEBOOK_PROJECTS = [
  ["prohibited-online", "Pro.Hibited Online", [
    "Si tu pouvais saboter ton propre plan pour faire rire la table, tu le ferais ?",
    "Dans un jeu en ligne, tu préfères une revanche immédiate ou le temps de refaire la partie avec les autres ?",
    "Pour découvrir Pro.Hibited Online, tu voudrais voir un premier tour ou le moment où le plan déraille ?",
  ]],
  ["blacklace-dice", "Blacklace Dice", [
    "Le dé tombe sous la table. Résultat annulé ou les enfers comptent comme surface de jeu ?",
    "Quel détail rend un lancer plus satisfaisant pour toi : le bruit, le suspense ou la réaction des autres ?",
    "Pour découvrir Blacklace Dice, tu commencerais par un lancer commenté ou un petit défi à tenter en groupe ?",
  ]],
  ["feuch-dice", "Feuch Dice", [
    "Tu as droit à une formule ridicule pour porter chance à ton prochain lancer. Laquelle ?",
    "Pour rendre un lancer mémorable, tu travaillerais d’abord le rythme ou la surprise ?",
    "Pour découvrir Feuch Dice, tu voterais pour un défi éclair ou une revanche en trois manches ?",
  ]],
  ["prout-hibited", "Prout.Hibited", [
    "Concours de poker face : qui dans ta bande craquerait en premier si le jeu avait ce nom ?",
    "Où placerais-tu le curseur de l’absurde : dans le titre, dans la situation ou dans la chute ?",
    "Pour présenter Prout.Hibited en dix secondes, tu tenterais le pitch très sérieux ou la bande-annonce complètement absurde ?",
  ]],
  ["jointed", "Jointed", [
    "Imagine deux cartes adversaires condamnées à faire équipe. Quels noms donnerais-tu à ce duo improbable ?",
    "Pour une combinaison de cartes, tu préfères comprendre l’idée tout de suite ou la découvrir en jouant ?",
    "Pour découvrir Jointed, tu regarderais d’abord une association de cartes ou le dilemme qui force à choisir ?",
  ]],
  ["420-dice", "420 Dice Game", [
    "Quand un lancer ne te donne rien, tu accuses le hasard, la gravité ou ton dé porte-malheur ?",
    "Dans une séquence de dés, tu couperais l’image sur le lancer ou sur la tête du joueur juste après ?",
    "Pour découvrir 420 Dice Game, tu veux voir le lancer le plus chanceux ou celui que personne ne voudrait assumer ?",
  ]],
  ["blacklace-island", "Blacklace Island", [
    "Tu débarques sur une île au crépuscule. Tu suis les lucioles ou tu cherches d’abord un abri ?",
    "Sur une carte d’île, quel premier repère te donne envie d’explorer : une lumière au loin ou un chemin qui disparaît ?",
    "Pour découvrir Blacklace Island, tu ferais le tour de la côte ou tu irais droit vers le point le plus mystérieux ?",
  ]],
  ["feuch-game", "Feuch Game", [
    "Quel est le pire superpouvoir à avoir un soir de jeu ? Le mien serait de deviner le résultat juste après le lancer.",
    "Qu’est-ce qui fait un bon premier tour : un choix évident pour se lancer ou un dilemme qui donne tout de suite le ton ?",
    "Pour découvrir Feuch Game, tu préfères un défi à relever ensemble ou chacun son tour sous le regard des autres ?",
  ]],
];
const LOCAL_FOLLOWUPS = [
  "",
  " Et qu’est-ce qui te ferait changer d’avis ?",
  " Demande à la personne avec qui tu joues le plus : elle choisirait comme toi ?",
];
const EDITORIAL_ANGLES = [
  ["entertainment", "Une question amusante ou un mini-défi imaginaire pour les joueurs."],
  ["behind-the-scenes", "Une question de conception concrète, formulée comme un choix ouvert."],
  ["promotion", "Une courte invitation à découvrir le projet avec une caractéristique vérifiée."],
];
// Only fixed project IDs choose the image subject. A generated caption never
// controls the source, the search terms, or the permissions on an asset.
const VISUAL_SEARCHES = {
  "prohibited-online": "playing cards on table",
  "blacklace-dice": "dice tabletop game",
  "feuch-dice": "dice tabletop game",
  "prout-hibited": "tabletop game playing cards",
  jointed: "playing cards hand",
  "420-dice": "three dice tabletop",
  "blacklace-island": "island aerial coastline",
  "feuch-game": "tabletop game pieces",
};

const OFFICIAL_VISUALS = {
  "420-dice": [
    {
      kind: "capture-source",
      title: "Jeu officiel · lancer réel à capturer",
      source: "https://benoitlub.github.io/420-dice-game-reboot/",
    },
    {
      kind: "official-preview",
      title: "Visuel officiel enregistré au studio · aperçu",
      source: "https://github.com/benoitlub/420-dice-game-reboot/blob/bf315300db5c5ab580c6f86bb14ae56d884b6739/public/opengraph.jpg",
      license: "Aperçu local autorisé",
    },
  ],
};

function isHttpsHost(value, host) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === host && !url.username && !url.password;
  } catch { return false; }
}

function commonsProposal(page) {
  const info = page.imageinfo?.[0];
  if (!info || !["image/jpeg", "image/png"].includes(info.mime) || info.width < 640) return null;
  if (!isHttpsHost(info.descriptionurl, "commons.wikimedia.org") || !isHttpsHost(info.url, "upload.wikimedia.org")) return null;
  const metadata = info.extmetadata;
  const license = metadata?.LicenseUrl?.value;
  if (!/^https?:\/\/creativecommons\.org\/(?:publicdomain\/(?:zero|mark)\/1\.0|licenses\/by\/(?:2\.0|2\.5|3\.0|4\.0))\/?$/i.test(license ?? "")) return null;
  if (metadata?.Restrictions?.value?.trim()) return null;
  const author = (metadata?.Artist?.value ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (license.includes("/licenses/by/") && !author) return null;
  return {
    kind: "commons-illustration",
    title: String(page.title ?? "Illustration").replace(/^File:/, "").slice(0, 160),
    source: info.descriptionurl,
    mediaUrl: info.url,
    license,
    author,
  };
}

async function proposeVisuals(seedId) {
  const query = VISUAL_SEARCHES[seedId];
  if (!query) return [];
  const proposals = [...(OFFICIAL_VISUALS[seedId] ?? [])];
  try {
    const api = new URL("https://commons.wikimedia.org/w/api.php");
    api.search = new URLSearchParams({
      action: "query", generator: "search", gsrnamespace: "6", gsrlimit: "8",
      gsrsearch: `filetype:bitmap ${query}`, prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata", format: "json", formatversion: "2",
    }).toString();
    const response = await fetch(api, {
      headers: { "User-Agent": "PoulpeFiction/1.0 (https://github.com/benoitlub/poulpe-fiction)" },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error("Commons API error");
    const commons = (result.query?.pages ?? []).map(commonsProposal).filter(Boolean).slice(0, 2);
    proposals.push(...commons);
  } catch (error) {
    console.log(JSON.stringify({ event: "gerard.visual-library.unavailable", seedId, reason: error.name === "TimeoutError" ? "timeout" : "commons-request-failed" }));
  }
  if (process.env.GITHUB_STEP_SUMMARY && proposals.length) {
    // Use fixed link labels; remote file titles and author metadata stay in
    // the private ledger and cannot inject Markdown into the Actions summary.
    const links = proposals.map(({ kind, source, license }) => {
      const label = { "capture-source": "Page officielle à capturer", "official-preview": "Visuel officiel pour aperçu",
        "commons-illustration": "Illustration Wikimedia Commons" }[kind];
      const terms = kind === "commons-illustration" ? ` · [licence](<${license}>)` : "";
      return `- [${label}](<${source}>)${terms}`;
    });
    try {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Visuels proposés par Gérard · ${seedId}\n\n${links.join("\n")}\n`);
    } catch {
      console.log(JSON.stringify({ event: "gerard.visual-summary.unavailable", seedId }));
    }
  }
  return proposals;
}

const FALLBACK_LEDGER = new URL("../garden/gerard-metricool-fallback.json", import.meta.url);
const PRODUCTION_LEDGER = new URL("../garden/gerard-metricool-production-history.json", import.meta.url);
const PREPARED = new URL("../garden/gerard-metricool-prepared.json", import.meta.url);
const RECEIPT = new URL("../garden/gerard-metricool-prepared-receipt.json", import.meta.url);

async function readOptional(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; return fallback; }
}

async function pendingPrepared() {
  const [item, receipt] = await Promise.all([readOptional(PREPARED), readOptional(RECEIPT)]);
  if (item?.candidate?.harvestId && receipt?.harvestId !== item.candidate.harvestId &&
      Date.now() - Date.parse(item.preparedAt) < 24 * 60 * 60 * 1000) return item.candidate;
  return null;
}

function copyKey(text) {
  return text.normalize("NFKC").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();
}

async function requestPublisherCaption(project, angle, oldCaptions) {
  const [seedId, title] = project;
  const [category, treatment] = angle;
  const objective = "Écrire un seul post Facebook en français pour la marque Pro.hibited.";
  const benchmarks = await loadCreativeBenchmarks([seedId, title]);
  const response = await fetch(`${(process.env.OCTOPUS_URL || "http://127.0.0.1:3000").replace(/\/$/, "")}/mission`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      operationId: `gerard-social-fallback-${seedId}-${category}-${Date.now()}`,
      title, objective, requiredCapabilities: ["content.social.write"], authorizedResources: [],
      prompt: [
        objective, `Sujet unique : ${title}.`, treatment,
        ...creativeBenchmarkPrompt(benchmarks),
        "Dans le champ content, écris uniquement la légende prête à poster, en texte simple, 450 caractères maximum.",
        "Aucun lien, prix, disponibilité ou promesse. N'invente aucune règle du jeu, anecdote ni citation.",
        "Aucun scénario de tournage, commentaire interne, Markdown, second projet ou invitation à acheter une substance.",
        ...oldCaptions.slice(-3).map(text => `Angle à ne pas répéter : ${JSON.stringify(text)}`),
      ].join("\n"),
      context: { id: seedId, label: title, metadata: {
        source: "gerard-cycle", agentName: "Gérard", knowledgeSlug: seedId, platform: "Facebook",
      } },
    }),
  });
  if (!response.ok) throw new Error(`octopus-http-${response.status}`);
  const result = await response.json();
  const output = result?.output;
  const text = typeof output?.text === "string" ? output.text.trim() : "";
  if (output?.isMock || output?.mock || output?.simulated || output?.provider === "mock") {
    const limited = /429|rate limit|quota/i.test(output?.fallbackReason ?? "");
    throw new Error(limited ? "provider-rate-limited" : "provider-unavailable");
  }
  if (result.status !== "completed" || output?.knowledgePackage?.verified !== true)
    throw new Error("project-knowledge-unavailable");
  if (text.length < 25 || text.length > 500 || /https?:\/\/|\*\*|^\s*#\s|\[[^\]]+\]|voix off|plan serré|mode mock actif/im.test(text))
    throw new Error("caption-not-ready");
  return text;
}

function makeFacebookCandidate(project, angle, text, strategy) {
  const [seedId, title] = project;
  const [category] = angle;
  const hash = createHash("sha256").update(copyKey(text)).digest("hex");
  return {
    status: "ready", harvestId: `gerard-facebook-${hash}`, seedId, title, category,
    copy: { text, strategy }, compatibleNetworks: ["facebook"],
    transport: { provider: "metricool", brandId: "3350145" },
    editorialRoute: { destination: { preferredProvider: "metricool" } },
  };
}

async function prepareMetricoolFallback({ prepareOnly = false } = {}) {
  const ledgerPath = prepareOnly ? PRODUCTION_LEDGER : FALLBACK_LEDGER;
  const ledger = await readOptional(ledgerPath, { cursor: 0, history: [] });
  const otherLedger = await readOptional(prepareOnly ? FALLBACK_LEDGER : PRODUCTION_LEDGER, { history: [] });
  const topics = EDITORIAL_ANGLES.flatMap(angle => FACEBOOK_PROJECTS.map(project => ({ project, angle })));
  const recent = ledger.history.slice(-200);
  const seen = new Set([...recent, ...otherLedger.history].filter(item => typeof item.text === "string").map(item => copyKey(item.text)));
  let publisherFailure = null;
  let candidate;
  for (let attempt = 0; attempt < topics.length; attempt++) {
    const { project, angle } = topics[ledger.cursor % topics.length];
    ledger.cursor = (ledger.cursor + 1) % topics.length;
    const [seedId, title, captions] = project;
    const [category] = angle;
    if (attempt === 0 && process.env.GERARD_METRICOOL_LOCAL_ONLY !== "true") {
      try {
        const previous = recent.filter(item => item.seedId === seedId && item.text).map(item => item.text);
        const text = await requestPublisherCaption(project, angle, previous);
        if (seen.has(copyKey(text))) throw new Error("caption-already-tried");
        candidate = makeFacebookCandidate(project, angle, text, "publisher");
        break;
      } catch (error) {
        publisherFailure = error.name === "TimeoutError" ? "publisher-timeout" : error.message;
      }
    }
    if (prepareOnly) break;
    const base = captions[EDITORIAL_ANGLES.indexOf(angle)];
    const text = LOCAL_FOLLOWUPS
      .map(followup => `${title} — ${base}${followup}`)
      .find(caption => !seen.has(copyKey(caption)));
    if (text) {
      candidate = makeFacebookCandidate(project, angle, text, "local-editorial");
      break;
    }
  }
  const save = () => writeFile(ledgerPath, JSON.stringify({ cursor: ledger.cursor, history: recent.slice(-200) }) + "\n");
  if (!candidate) {
    if (prepareOnly) await save();
    return { status: prepareOnly ? "no-draft-prepared" : "local-catalogue-exhausted", publisherFailure };
  }
  const { seedId, category, copy: { text, strategy } } = candidate;
  const visualProposals = await proposeVisuals(seedId);
  const entry = { at: new Date().toISOString(), seedId, category, text, strategy, publisherFailure, visualProposals, status: "prepared" };
  recent.push(entry);
  await save();
  if (prepareOnly) {
    await writeFile(PREPARED, JSON.stringify({ preparedAt: entry.at, candidate }) + "\n");
    return { seedId, category, strategy, status: "prepared-for-diffusion", visualProposalCount: visualProposals.length };
  }
  const delivered = await handoffMetricoolByEmail(candidate);
  entry.status = delivered.metricoolHandoff?.status ?? "handoff-ineligible";
  entry.handoff = delivered.metricoolHandoff ?? null;
  await save();
  return { seedId, category, strategy, publisherFailure, status: entry.status, visualProposalCount: visualProposals.length, handoff: entry.handoff };
}

async function main() {
  if (process.env.GERARD_METRICOOL_PREPARE_ONLY === "true") {
    if (await pendingPrepared()) return;
    console.log(JSON.stringify({ metricoolPreparation: await prepareMetricoolFallback({ prepareOnly: true }) }));
    return;
  }
  const path = "garden/next-social-publication.json";
  const candidate = JSON.parse(await readFile(path, "utf8"));
  if (process.env.GERARD_METRICOOL_EXECUTION_ENABLED !== "true") return;
  const updated = await handoffMetricoolByEmail(candidate);
  if (updated.metricoolHandoff) {
    await writeFile(path, JSON.stringify(updated, null, 2) + "\n");
    console.log(JSON.stringify({ metricoolHandoff: updated.metricoolHandoff }));
    return;
  }
  const prepared = await pendingPrepared();
  if (prepared) {
    const delivered = await handoffMetricoolByEmail(prepared);
    if (delivered.metricoolHandoff) {
      await writeFile(RECEIPT, JSON.stringify({ harvestId: prepared.harvestId, ...delivered.metricoolHandoff }) + "\n");
      if (candidate.transport?.provider !== "buffer") {
        await writeFile(path, JSON.stringify(delivered, null, 2) + "\n");
      }
      console.log(JSON.stringify({ metricoolHandoff: delivered.metricoolHandoff, source: "production-tentacle" }));
      return;
    }
  }
  const fallback = await prepareMetricoolFallback();
  console.log(JSON.stringify({ metricoolHandoff: fallback.handoff ?? null, metricoolFallback: fallback }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
