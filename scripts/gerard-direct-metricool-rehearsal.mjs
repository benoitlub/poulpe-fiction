// Read-only rehearsal of the original Octopus -> Publisher -> Metricool transport.
// Runs where the production tentacle already has a live local Octopus adapter.
// Never writes to the publication queue and never sets execute=true.
import { readFile } from "node:fs/promises";
import { metricoolMission, submitMetricoolPublication } from "./gerard-metricool-publication.mjs";

const file = new URL("../garden/gerard-metricool-prepared.json", import.meta.url);
let prepared;
try {
  prepared = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  if (error.code === "ENOENT") {
    console.log(JSON.stringify({ status: "no-prepared-candidate", executed: false }));
    process.exit(0);
  }
  throw error;
}
// Mirror production eligibility: do not rehearse stale or consumed work.
const ageMs = Date.now() - Date.parse(prepared?.preparedAt);
if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 24 * 60 * 60 * 1000) {
  console.log(JSON.stringify({ status: "stale-preparation", executed: false }));
  process.exit(0);
}
let receipt = null;
try {
  receipt = JSON.parse(await readFile(new URL("../garden/gerard-metricool-prepared-receipt.json", import.meta.url), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const candidate = prepared?.candidate;
if (receipt?.harvestId && receipt.harvestId === candidate?.harvestId) {
  console.log(JSON.stringify({ status: "already-handed-off", executed: false }));
  process.exit(0);
}
if (candidate?.copy?.strategy === "local-editorial" && candidate?.harvestId?.startsWith("gerard-facebook-")) {
  console.log(JSON.stringify({ status: "legacy-local-draft", executed: false }));
  process.exit(0);
}
const mission = metricoolMission(candidate, { execute: false });
if (!mission) {
  console.log(JSON.stringify({ status: "ineligible", executed: false, reason: "metricool-mission-not-eligible" }));
  process.exit(0);
}
if (mission.context.metadata.socialPublication.dryRun !== true) {
  throw new Error("Direct rehearsal must remain dry-run");
}
const result = await submitMetricoolPublication(candidate, {
  execute: false,
  octopusUrl: process.env.OCTOPUS_URL || "http://127.0.0.1:3000",
});
const handoff = result.metricoolHandoff || {};
console.log(JSON.stringify({
  status: handoff.status || "unconfirmed",
  stage: handoff.stage || null,
  reason: handoff.reason || null,
  executed: false,
  dryRun: true,
  // No external postId or payload is persisted: this is diagnostic only.
}));
