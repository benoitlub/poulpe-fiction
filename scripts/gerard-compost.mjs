#!/usr/bin/env node
/**
 * Gérard Garden compost: reversible classification, never deletion.
 * Only explicit mock placeholders, cross-client ads and exact duplicates within the SAME
 * parcel/seed may be composted. The learning log and publication records
 * are intentionally untouched. No LLM or external provider is called.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const HARVESTS_PATH = new URL("../garden/harvests.json", import.meta.url);
const REPORT_PATH = new URL("../garden/compost-report.json", import.meta.url);

export function isSimulatedHarvest(item) {
  if (!item || typeof item !== "object") return false;
  if (item.isMock === true || item.simulated === true || item.verification?.simulated === true) return true;
  const content = typeof item.content === "string" ? item.content.trim() : "";
  // Strong signature of the previously stored Sofia fallback, not a broad
  // "mock" keyword that could accidentally flag genuine creative writing.
  return /^Contenu généré pour l'univers .+ par Sofia\. Mode mock actif\s*[—-]\s*configurez AI_PROVIDER et AI_API_KEY pour une génération réelle\.$/i.test(content);
}

/**
 * A 420 Dice promotional campaign inside Yaébali's real-estate parcel is a
 * cross-client contamination. Preserve the historic artifact but never offer
 * it as a client deliverable. This does not match a mere negative warning.
 */
export function isCrossParcelYaebaliHarvest(item) {
  if (!item || typeof item !== "object" ||
      (item.seedId !== "yael-prospection" && item.parcelId !== "project-yael-prospection")) return false;
  const text = String(item.content ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();
  return /420 dice/.test(text) &&
    (/(?:reel|campagne)\\s+(?:instagram\\s+)?(?:\\([^)]*\\)\\s*[-–]\\s*)?420 dice/.test(text) ||
     /@pro\\.hbtd/.test(text) || /benoitlub\\.github\\.io\\/420-dice-game-reboot/.test(text));
}

function normalizedContent(content) {
  return String(content || "").trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
}

function active(item) {
  return item?.state !== "composted" && item?.state !== "archived";
}

export function compostHarvests(harvests, { now = new Date().toISOString() } = {}) {
  if (!Array.isArray(harvests)) throw new TypeError("harvests must be an array");
  const seen = new Map();
  const changedIds = [];
  const counts = { simulated: 0, exactDuplicate: 0, crossParcel: 0 };
  const updated = harvests.map(original => {
    if (!original || typeof original !== "object" || !active(original)) return original;
    const value = normalizedContent(original.content);
    if (!value) return original;
    let reason = null;
    let canonicalHarvestId = null;
    if (isSimulatedHarvest(original)) {
      reason = "simulated-provider-placeholder";
      counts.simulated += 1;
    } else if (isCrossParcelYaebaliHarvest(original)) {
      reason = "cross-parcel-420-dice-in-yaebali";
      counts.crossParcel += 1;
    } else {
      // Do NOT dedupe different parcels or seeds: they may have different
      // recipients, rights, or publication histories.
      const key = JSON.stringify([original.parcelId ?? null, original.seedId ?? null, value]);
      if (seen.has(key)) {
        reason = "exact-content-duplicate";
        canonicalHarvestId = seen.get(key);
        counts.exactDuplicate += 1;
      } else {
        seen.set(key, original.harvestId ?? null);
      }
    }
    if (!reason) return original;
    changedIds.push(original.harvestId ?? null);
    return {
      ...original, state: "composted",
      compost: {
        reason,
        compostedAt: now,
        previousState: original.state ?? "harvested",
        canonicalHarvestId,
        policy: "gerard-local-compost-v1",
        recoverable: true,
      },
    };
  });
  const activeHarvests = updated.filter(h => h && active(h)).length;
  const compostedHarvests = updated.filter(h => h?.state === "composted").length;
  const report = {
    at: now,
    contract: "gerard-compost-report-v1",
    scope: "local-harvests-only",
    previousTotal: harvests.length,
    totalHarvests: updated.length,
    newlyComposted: changedIds.length,
    reasons: counts,
    activeHarvests,
    compostedHarvests,
    archivedHarvests: updated.filter(h => h?.state === "archived").length,
    newlyCompostedIds: changedIds,
    action: changedIds.length ? "marked-composted" : "no-change",
    safeguards: {
      deleted: 0,
      learningHistoryChanged: false,
      remotePublisherChanged: false,
      socialPostsChanged: false,
      onlyExactDuplicatesOrExplicitContamination: true,
      reversible: true,
    },
    note: "Contents, IDs and provenance stay in garden/harvests.json. The state can be restored manually. No remote data or publication was changed.",
  };
  return { harvests: updated, report };
}

async function main() {
  const data = JSON.parse(await readFile(HARVESTS_PATH, "utf8"));
  const { harvests, report } = compostHarvests(data.harvests);
  if (report.newlyComposted) {
    await writeFile(HARVESTS_PATH, JSON.stringify({ ...data, harvests }, null, 2) + "\n");
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ action: report.action, new: report.newlyComposted, reasons: report.reasons, active: report.activeHarvests, composted: report.compostedHarvests }));
}

if (process.argv[1] && import.meta.url === new URL("file://" + fileURLToPath(import.meta.url)).href) {
  // Run main only as a CLI, not when unit tests import functions.
  if (fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
  }
}
