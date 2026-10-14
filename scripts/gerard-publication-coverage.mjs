#!/usr/bin/env node
/**
 * Gérard's publication coverage is a conservative observation, NOT a quota meter.
 * Publisher /api/tentacles/iterations records creative work, never publication.
 * The manually verified Metricool snapshot is incomplete until refreshed by a
 * provider-confirmed inventory; never turn absent data into "0 used".
 */
import { readFile, writeFile } from "node:fs/promises";

const FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
});

function publishedDay(entry) {
  // Verified connector data sometimes contains only a calendar date. Accept
  // that precision rather than inventing a time of day.
  const dateOnly = entry?.publicationDate?.date;
  if (typeof dateOnly === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOnly)) return dateOnly;
  const dateTime = entry?.publicationDate?.dateTime;
  if (typeof dateTime !== "string") return null;
  // Metricool snapshot supplies a local wall-clock time and Europe/Madrid
  // timezone (same date/calendar as Europe/Paris).
  if (entry?.publicationDate?.timezone === "Europe/Madrid" ||
      entry?.publicationDate?.timezone === "Europe/Paris") {
    const match = /^(\d{4}-\d{2}-\d{2})T/.exec(dateTime);
    return match?.[1] ?? null;
  }
  const instant = new Date(dateTime);
  return Number.isFinite(instant.valueOf()) ? FORMATTER.format(instant) : null;
}

export function buildPublicationCoverage({ iterationsPayload, seedsPayload, metricoolSnapshot, now = new Date() }) {
  const day = FORMATTER.format(now);
  const month = day.slice(0, 7);
  const iterations = Array.isArray(iterationsPayload?.iterations) ? iterationsPayload.iterations : [];
  const seeds = Array.isArray(seedsPayload?.seeds) ? seedsPayload.seeds : [];
  const parcelIds = [...new Set(seeds.map(s => s?.parcelId).filter(Boolean))];

  // Snapshot is historical evidence, not a provider-confirmed *current* quota.
  const matchingMonth = metricoolSnapshot?.period === month;
  const historic = matchingMonth && Array.isArray(metricoolSnapshot?.published)
    ? metricoolSnapshot.published : [];
  const seen = new Set();
  const observed = historic.filter(entry => {
    const publishedAt = publishedDay(entry);
    if (!publishedAt || !publishedAt.startsWith(month)) return false;
    const id = String(entry?.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const knownToday = observed.filter(entry => publishedDay(entry) === day);
  const observedNetworkDeliveries = observed.reduce(
    (total, entry) => total + (Array.isArray(entry.networks) ? new Set(entry.networks).size : 0), 0,
  );

  const monthlyLimit = 20;
  const coverage = parcelIds.map(parcelId => ({
    parcelId,
    // A Publisher iteration or a global Metricool post cannot reliably be
    // attributed to this parcel. Unknown is NOT false and NOT zero.
    publishedToday: null,
    publicationCountToday: null,
    publicationCountMonth: null,
    status: "not-verifiable-from-iterations",
    publisherIterationCount: iterations.filter(i => i.parcel_id === parcelId).length,
  }));
  const report = {
    checkedAt: now.toISOString(),
    timezone: "Europe/Paris",
    day, month,
    metricoolBudget: {
      limit: monthlyLimit,
      used: null,
      remaining: null,
      exhausted: null,
      verified: false,
      status: "incomplete-provider-history",
      minimumObservedPosts: observed.length,
      minimumObservedNetworkDeliveries: observedNetworkDeliveries,
      observedPostsToday: knownToday.length,
      source: matchingMonth ? "metricool-manually-verified-snapshot" : "no-current-month-snapshot",
      policy: "Do not auto-schedule from this report; verify the actual Metricool monthly usage first.",
      note: "Publisher iterations are production records, not posts. A past snapshot cannot establish current usage or remaining plan quota.",
    },
    target: "Respect Metricool quota; rotate parcels when actual published/queued history is verified.",
    coverage,
  };
  return report;
}

async function main() {
  const iterationsPayload = JSON.parse(await readFile(process.argv[2], "utf8"));
  const seedsPayload = JSON.parse(await readFile("garden/restart-seeds.json", "utf8"));
  const metricoolSnapshot = await readFile("garden/metricool-published-snapshot.json", "utf8")
    .then(JSON.parse).catch(() => null);
  const report = buildPublicationCoverage({ iterationsPayload, seedsPayload, metricoolSnapshot });
  await writeFile("garden/daily-publication-coverage.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ day: report.day, metricoolBudget: report.metricoolBudget, coverage: report.coverage }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
