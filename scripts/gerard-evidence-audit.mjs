#!/usr/bin/env node
/**
 * Read-only, offline evidence check. No provider calls, no database writes.
 * A successful cycle is NOT proof of delivery.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export function classifyCycle(entry = {}) {
  const result = entry.lastResult && typeof entry.lastResult === "object" ? entry.lastResult : entry;
  const status = result.status ?? entry.result ?? "unknown";
  const studio = result.studio ?? {};
  const reason = studio.reason ?? studio.report?.code ?? result.reason ?? null;
  return {
    operationId: result.operationId ?? entry.operationId ?? null,
    seedId: result.seedId ?? entry.lastSeedId ?? null,
    status,
    reason,
    // An 'ok' cycle alone never proves delivery.
    delivery: result.published === true && result.postId ? "provider-confirmed" : "not-proven",
  };
}

export function classifyReceipt(receipt = {}) {
  const confirmed = receipt.status === "confirmed-published" || receipt.status === "confirmed-scheduled";
  const delivered = confirmed && Boolean(receipt.postId) &&
    (receipt.published === true || receipt.scheduled === true);
  return {
    operationId: receipt.operationId ?? null,
    postId: delivered ? receipt.postId : null,
    status: delivered ? receipt.status : "unconfirmed",
    delivery: delivered ? "provider-confirmed" : "not-proven",
    reason: receipt.reason ?? null,
  };
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function auditFiles({ statePath, studioPath, receiptPath }) {
  const [state, studio, receipts] = await Promise.all([
    readJson(statePath), readJson(studioPath), readJson(receiptPath),
  ]);
  const cycles = [state, studio].filter(Boolean).map(classifyCycle);
  const entries = Array.isArray(receipts) ? receipts :
    Array.isArray(receipts?.history) ? receipts.history :
    Array.isArray(receipts?.publications) ? receipts.publications : [];
  return {
    generatedAt: new Date().toISOString(),
    source: "local-public-projections-only",
    note: "Private PostgreSQL state and provider API were NOT queried.",
    cycles,
    receipts: entries.slice(-20).map(classifyReceipt),
    missingFiles: [
      !state && statePath, !studio && studioPath, !receipts && receiptPath,
    ].filter(Boolean),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const output = await auditFiles({
    statePath: new URL("../garden/gerard-state.json", import.meta.url),
    studioPath: new URL("../garden/gerard-studio-state.json", import.meta.url),
    receiptPath: new URL("../garden/gerard-metricool-production-history.json", import.meta.url),
  });
  console.log(JSON.stringify(output, null, 2));
}
