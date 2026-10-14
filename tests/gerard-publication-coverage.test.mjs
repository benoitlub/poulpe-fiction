import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicationCoverage } from "../scripts/gerard-publication-coverage.mjs";

const now = new Date("2026-10-14T16:30:00Z");
const seedsPayload = { seeds: [{ parcelId: "poulpe-fiction" }, { parcelId: "project-yael-prospection" }] };
const iterationsPayload = { iterations: [
  { id: "a", parcel_id: "poulpe-fiction", created_at: "2026-10-14T16:00:00Z" },
  { id: "b", parcel_id: "project-yael-prospection", created_at: "2026-10-12T08:00:00Z" },
] };
const metricoolSnapshot = { period: "2026-10", published: [
  { id: 1, publicationDate: { dateTime: "2026-10-06T10:35:00", timezone: "Europe/Madrid" }, networks: ["facebook", "instagram"] },
  { id: 2, publicationDate: { dateTime: "2026-10-05T15:45:00", timezone: "Europe/Madrid" }, networks: ["facebook"] },
  { id: 3, publicationDate: { dateTime: "2026-10-09T10:00:00", timezone: "Europe/Madrid" }, networks: ["facebook"] },
] };

test("reported quota never equates Publisher iterations with Metricool posts", () => {
  const report = buildPublicationCoverage({ now, seedsPayload, iterationsPayload, metricoolSnapshot });
  assert.equal(report.day, "2026-10-14");
  assert.equal(report.metricoolBudget.minimumObservedPosts, 3);
  assert.equal(report.metricoolBudget.minimumObservedNetworkDeliveries, 4);
  assert.equal(report.metricoolBudget.used, null);
  assert.equal(report.metricoolBudget.remaining, null);
  assert.equal(report.metricoolBudget.verified, false);
  assert.equal(report.coverage[0].publisherIterationCount, 1);
  assert.equal(report.coverage[0].publicationCountMonth, null);
  assert.equal(report.coverage[0].publishedToday, null);
});

test("old snapshot never acts as current-month budget", () => {
  const report = buildPublicationCoverage({ now, seedsPayload, iterationsPayload, metricoolSnapshot: { ...metricoolSnapshot, period: "2026-09" } });
  assert.equal(report.metricoolBudget.minimumObservedPosts, 0);
  assert.equal(report.metricoolBudget.source, "no-current-month-snapshot");
  assert.equal(report.metricoolBudget.remaining, null);
});

test("duplicate Metricool post IDs do not double-count crossposts", () => {
  const report = buildPublicationCoverage({ now, seedsPayload, iterationsPayload, metricoolSnapshot: {
    period: "2026-10", published: [metricoolSnapshot.published[0], metricoolSnapshot.published[0]],
  } });
  assert.equal(report.metricoolBudget.minimumObservedPosts, 1);
  assert.equal(report.metricoolBudget.minimumObservedNetworkDeliveries, 2);
});

test("missing snapshot never claims an empty publication month", () => {
  const report = buildPublicationCoverage({ now, seedsPayload, iterationsPayload });
  assert.equal(report.metricoolBudget.used, null);
  assert.equal(report.metricoolBudget.remaining, null);
  assert.equal(report.metricoolBudget.minimumObservedPosts, 0);
});
