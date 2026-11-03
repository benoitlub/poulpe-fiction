import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Attach only a committed, prior-run Studio MP4 to the matching Metricool
 * package. A video with explicit owner no-auto-publish guidance stays in review.
 */
export function attachStudioVideo(candidate, studio, learning = {}, { publisherUrl = process.env.PUBLISHER_URL, currentRunId = process.env.GITHUB_RUN_ID } = {}) {
  if (!candidate || !studio || studio.producedRunId === currentRunId ||
      typeof studio.seedId !== "string" || typeof studio.parcelId !== "string" ||
      typeof studio.operationId !== "string" || typeof studio.bytes !== "number" || studio.bytes <= 0 ||
      studio.seedId !== candidate.seedId ||
      !/^[a-f0-9]{64}$/.test(studio.sha256 ?? "") ||
      candidate.status !== "ready" || candidate.transport?.provider !== "metricool" ||
      candidate.editorialRoute?.destination?.preferredProvider !== "metricool" ||
      candidate.action === "do-not-schedule" || candidate.metricoolHandoff?.scheduled || candidate.metricoolHandoff?.published ||
      !candidate.harvestId || !Array.isArray(candidate.compatibleNetworks) ||
      !candidate.compatibleNetworks.length || candidate.compatibleNetworks.some((network) => !["facebook", "instagram"].includes(network))) return candidate;
  const feedback = [
    ...(learning?.guidance?.ownerCreativeFeedback ?? []),
    ...(learning?.ownerFeedback ?? []),
  ].filter((item) => item?.parcelId === studio.parcelId && item?.assetType === "short-video");
  const explicitPublicationHold = feedback.some((item) =>
    (item.prohibitedActions ?? []).some((action) => /automatiqu|automatically/i.test(action) && /publier|publication|publish/i.test(action)));
  if (explicitPublicationHold) return candidate;
  let base;
  try { base = new URL(publisherUrl); } catch { return candidate; }
  if (base.protocol !== "https:") return candidate;
  const parcel = encodeURIComponent(studio.parcelId);
  const id = encodeURIComponent(studio.operationId);
  const url = new URL("/api/production/studio-media/" + parcel + "/" + id + "/short.mp4", base).toString();
  return { ...candidate, media: {
    ...(candidate.media ?? {}), url, direct: true, generated: true,
    sourceHarvestId: candidate.harvestId,
    studioArtifact: { parcelId: studio.parcelId, operationId: studio.operationId, sha256: studio.sha256, bytes: studio.bytes },
  } };
}
export function metricoolMission(candidate, { execute = false, now = new Date() } = {}) {
  if (candidate?.status !== "ready" || candidate?.transport?.provider !== "metricool" ||
      candidate?.editorialRoute?.destination?.preferredProvider !== "metricool" ||
      candidate?.action === "do-not-schedule") return null;
  const harvestId = typeof candidate.harvestId === "string" ? candidate.harvestId.trim() : "";
  const text = typeof candidate.copy?.text === "string" ? candidate.copy.text : "";
  const media = candidate.media?.url ? [candidate.media.url] : [];
  const allowed = media.length ? ["facebook", "instagram"] : ["facebook"];
  // Respect the networks supplied by the media/selection capability. Do not
  // quietly add Instagram to a Facebook-only decision because a URL exists.
  const networks = [...new Set(candidate.compatibleNetworks ?? [])];
  if (networks.some(n => !allowed.includes(n))) return null;
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

async function main() {
  const path = "garden/next-social-publication.json";
  let candidate = JSON.parse(await readFile(path, "utf8"));
  const [state, learning] = await Promise.all([
    readFile("garden/gerard-state.json", "utf8").then(JSON.parse).catch(() => ({})),
    readFile("garden/gerard-learning.json", "utf8").then(JSON.parse).catch(() => ({})),
  ]);
  candidate = attachStudioVideo(candidate, state.latestStudioArtifact, learning);
  const updated = await submitMetricoolPublication(candidate, {
    execute: process.env.GERARD_METRICOOL_EXECUTION_ENABLED === "true", octopusUrl: process.env.OCTOPUS_URL,
  });
  await writeFile(path, JSON.stringify(updated, null, 2) + "\n");
  console.log(JSON.stringify({ metricoolHandoff: updated.metricoolHandoff ?? null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
