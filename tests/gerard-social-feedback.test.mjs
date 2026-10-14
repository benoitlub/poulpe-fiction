import test from "node:test";
import assert from "node:assert/strict";
import { applyMetricoolFeedback } from "../scripts/gerard-social-feedback.mjs";

const timestamp = "2026-10-14T17:40:00Z";
const snapshot = {
  status: "available", source: "metricool-connected-analytics", checkedAt: "2026-10-14",
  posts: [
    { network: "facebook", verified: true, date: "2026-10-05", url: "https://facebook.com/p/test", text: "Test de transmission", metrics: { reach: 7, linkClicks: 0 } },
    { network: "facebook", verified: true, date: "2026-10-06", url: "https://facebook.com/p/420", text: "420 Dice", metrics: { reach: 1, linkClicks: 0 } },
    { network: "instagram", verified: true, date: "2026-10-06", url: "https://instagram.com/p/420", text: "420 Dice", metrics: { reach: 17, interactions: 0 } },
    { network: "facebook", verified: true, date: "2026-10-13", url: "https://facebook.com/p/blacklace", text: "Blacklace Dice", metrics: { reach: 1, linkClicks: 1 } },
  ],
};
const previous = { observations: [{ kind: "operational", lesson: "preserve" }], guidance: { chosenExperiment: "explore" } };

test("verified evidence is remembered without inventing a winner", () => {
  const result = applyMetricoolFeedback(previous, snapshot, { now: timestamp });
  assert.equal(result.added, 4);
  assert.equal(result.learning.observations.length, 5);
  assert.equal(result.learning.guidance.chosenExperiment, "explore");
  assert.equal(result.learning.guidance.performanceRankingEnabled, false);
  assert.equal(result.learning.socialFeedback.technicalTestPostCount, 1);
  assert.equal(result.learning.socialFeedback.networks.facebook.linkClicksObserved, 1);
  assert.equal(result.learning.socialFeedback.networks.instagram.medianObservedReach, 17);
  assert.equal(result.learning.socialFeedback.posts.find(p => p.network === "instagram").metrics.interactions, 0);
});

test("replaying the same provider snapshot does not duplicate evidence", () => {
  const first = applyMetricoolFeedback(previous, snapshot, { now: timestamp });
  const second = applyMetricoolFeedback(first.learning, snapshot, { now: "2026-10-15T10:00:00Z" });
  assert.equal(second.added, 0);
  assert.equal(second.learning.observations.length, first.learning.observations.length);
});

test("provider data missing does not erase verified evidence", () => {
  const first = applyMetricoolFeedback(previous, snapshot, { now: timestamp });
  const second = applyMetricoolFeedback(first.learning, { status: "unavailable", posts: [] });
  assert.equal(second.changed, false);
  assert.deepEqual(second.learning.socialFeedback, first.learning.socialFeedback);
});

test("uncertified or malformed rows cannot become measured evidence", () => {
  const altered = { ...snapshot, posts: [
    { ...snapshot.posts[0], verified: false },
    { ...snapshot.posts[1], metrics: { reach: "7" } },
    { ...snapshot.posts[2], url: "missing" },
  ]};
  const result = applyMetricoolFeedback(previous, altered, { now: timestamp });
  assert.equal(result.seen, 0);
  assert.equal(result.added, 0);
});
