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
  const allowed = media.length ? ["facebook", "instagram"] : ["facebook"];
  // Respect the networks supplied by the media/selection capability. Do not
  // quietly add Instagram to a Facebook-only decision because a URL exists.
  const networks = [...new Set(candidate.compatibleNetworks ?? [])].filter(n => allowed.includes(n));
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

export async function submitMetricoolPublication(candidate, options = {}) {
  const mission = metricoolMission(candidate, options);
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
  return { ...candidate, metricoolHandoff: outcome,
    delivery: { status: outcome.status, publishingEnabled: outcome.scheduled || outcome.published, stage: outcome.stage, reason: outcome.reason } };
}

async function main() {
  const path = "garden/next-social-publication.json";
  const candidate = JSON.parse(await readFile(path, "utf8"));
  const updated = await submitMetricoolPublication(candidate, {
    execute: process.env.GERARD_METRICOOL_EXECUTION_ENABLED === "true", octopusUrl: process.env.OCTOPUS_URL,
  });
  await writeFile(path, JSON.stringify(updated, null, 2) + "\n");
  console.log(JSON.stringify({ metricoolHandoff: updated.metricoolHandoff ?? null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
