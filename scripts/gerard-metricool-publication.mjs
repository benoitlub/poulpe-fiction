import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

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

async function main() {
  const path = "garden/next-social-publication.json";
  const candidate = JSON.parse(await readFile(path, "utf8"));
  if (process.env.GERARD_METRICOOL_EXECUTION_ENABLED !== "true") return;
  const updated = await handoffMetricoolByEmail(candidate);
  await writeFile(path, JSON.stringify(updated, null, 2) + "\n");
  console.log(JSON.stringify({ metricoolHandoff: updated.metricoolHandoff ?? null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
