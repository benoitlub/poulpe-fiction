// Explicitly gated direct publishing path on the Production runner, where Octopus
// and Publisher actually exist. This script never runs an implicit live publish.
import { readFile, writeFile } from "node:fs/promises";
import { submitMetricoolPublication } from "./gerard-metricool-publication.mjs";

const PREPARED = new URL("../garden/gerard-metricool-prepared.json", import.meta.url);
const RECEIPT = new URL("../garden/gerard-metricool-prepared-receipt.json", import.meta.url);
const readOptional = async (url) => {
  try { return JSON.parse(await readFile(url, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};

const execute = process.env.GERARD_METRICOOL_DIRECT_EXECUTION_ENABLED === "true";
if (!execute) {
  console.log(JSON.stringify({ status: "direct-publishing-disabled", executed: false }));
  process.exit(0);
}
const prepared = await readOptional(PREPARED);
const candidate = prepared?.candidate;
const age = Date.now() - Date.parse(prepared?.preparedAt);
if (!candidate?.harvestId || !Number.isFinite(age) || age < 0 || age >= 86400000 ||
    candidate.copy?.strategy === "local-editorial" ||
    /420[^a-z0-9]*dice/i.test([candidate.seedId, candidate.title].join(" "))) {
  console.log(JSON.stringify({ status: "not-eligible", executed: false }));
  process.exit(0);
}
const receipt = await readOptional(RECEIPT);
if (receipt?.harvestId === candidate.harvestId) {
  console.log(JSON.stringify({ status: "already-handed-off", executed: false }));
  process.exit(0);
}
// Stable operation ID is derived by the legacy mission builder; provider must
// enforce idempotency. Ambiguous responses must never trigger an automatic retry.
const result = await submitMetricoolPublication(candidate, {
  execute: true,
  octopusUrl: process.env.OCTOPUS_URL || "http://127.0.0.1:3000",
});
const handoff = result.metricoolHandoff;
if (!handoff) {
  console.log(JSON.stringify({ status: "ineligible-mission", executed: false }));
  process.exit(0);
}
await writeFile(RECEIPT, JSON.stringify({
  harvestId: candidate.harvestId,
  operationId: handoff.operationId ?? null,
  status: handoff.status,
  postId: handoff.postId ?? null,
  scheduled: handoff.scheduled === true,
  published: handoff.published === true,
  // Receipt also prevents Gmail relay of the same candidate on later cycles.
  confirmationRequired: handoff.scheduled !== true && handoff.published !== true,
}) + "\n");
console.log(JSON.stringify({
  status: handoff.status, scheduled: handoff.scheduled === true,
  published: handoff.published === true,
  confirmationRequired: handoff.scheduled !== true && handoff.published !== true,
}));
