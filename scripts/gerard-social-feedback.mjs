#!/usr/bin/env node
/**
 * Reconcile VERIFIED Metricool per-post measurements into Gérard's existing
 * learning memory. This is evidence ingestion, not a publication or ranking
 * engine. The ChatGPT Metricool connector refreshes the snapshot separately.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function nonnegativeMetric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isTestPost(text) {
  return /^(?:test de transmission|test technique|test publication)\b/i.test(String(text || "").trim());
}

function metricObservation(post, now) {
  const metrics = {};
  for (const key of ["reach", "interactions", "comments", "likes", "shares", "reactions", "saves", "linkClicks", "engagementPerThousand"]) {
    const value = nonnegativeMetric(post?.metrics?.[key]);
    if (value !== null) metrics[key] = value;
  }
  return {
    observedAt: now,
    kind: "metricool-post-measurement",
    source: "metricool-connected-analytics",
    network: post.network,
    publishedDate: post.date ?? null,
    postUrl: post.url,
    copyText: post.text ?? null,
    postPurpose: isTestPost(post.text) ? "technical-test" : "promotion-unattributed",
    metrics,
    outcome: "measured-not-ranked",
    lesson: "These are observed provider metrics, not evidence of causality or Gerard authorship. Compare only compatible posts after collecting more observations.",
  };
}

export function applyMetricoolFeedback(learning, snapshot, { now = new Date().toISOString() } = {}) {
  const old = (learning && typeof learning === "object" && !Array.isArray(learning)) ? learning : {};
  const prior = old.socialFeedback || null;
  if (snapshot?.status !== "available" || snapshot?.source !== "metricool-connected-analytics" ||
      !Array.isArray(snapshot?.posts) || !snapshot.posts.length) {
    return {
      learning: {
        ...old,
        socialFeedback: prior ?? { status: "not-observed", source: "metricool", reason: "No verified per-post provider observations" },
      },
      added: 0, seen: 0, changed: false,
    };
  }
  const verified = new Map();
  for (const post of snapshot.posts) {
    if (post?.verified !== true || !["facebook", "instagram", "youtube"].includes(post.network) ||
        typeof post.url !== "string" || !/^https:\/\//.test(post.url) ||
        typeof post.text !== "string" || !post.text.trim()) continue;
    const entry = metricObservation(post, now);
    if (Object.keys(entry.metrics).length === 0) continue;
    const key = `${entry.network}|${entry.postUrl}`;
    verified.set(key, entry);
  }
  const posts = [...verified.values()].sort((a, b) =>
    (a.publishedDate ?? "").localeCompare(b.publishedDate ?? "") ||
    a.network.localeCompare(b.network) || a.postUrl.localeCompare(b.postUrl));
  const networks = {};
  for (const network of ["facebook", "instagram", "youtube"]) {
    const promotion = posts.filter(p => p.network === network && p.postPurpose !== "technical-test");
    if (!promotion.length) continue;
    const measuredReach = promotion.map(p => p.metrics.reach).filter(v => v !== undefined);
    const totalLinkClicks = promotion.map(p => p.metrics.linkClicks).filter(v => v !== undefined);
    networks[network] = {
      promotionalPostsObserved: promotion.length,
      reachSamples: measuredReach.length,
      medianObservedReach: median(measuredReach),
      linkClicksObserved: totalLinkClicks.length ? totalLinkClicks.reduce((a, b) => a + b, 0) : null,
      comparison: "descriptive-only",
      note: "Small, possibly incomplete sample. Do not rank subjects or infer audience preference.",
    };
  }
  const previousMetrics = Array.isArray(old.observations) ? old.observations : [];
  const recorded = new Set(previousMetrics
    .filter(item => item?.kind === "metricool-post-measurement")
    .map(item => JSON.stringify([item.network, item.postUrl, item.metrics])));
  const fresh = posts.filter(item => !recorded.has(JSON.stringify([item.network, item.postUrl, item.metrics])));
  const updatedObservations = [...previousMetrics, ...fresh].slice(-150);
  const socialFeedback = {
    status: "observed",
    source: "metricool-connected-analytics",
    snapshotCheckedAt: snapshot.checkedAt ?? null,
    snapshotPeriod: snapshot.period ?? null,
    completeness: "partial-provider-response",
    measuredPostCount: posts.length,
    technicalTestPostCount: posts.filter(p => p.postPurpose === "technical-test").length,
    networks,
    posts,
    lastIntegratedAt: now,
    inferencePolicy: "No cross-network ranking, no user-preference claims and no attribution of publication to Gerard without transport evidence.",
  };
  return {
    learning: {
      ...old,
      updatedAt: now,
      observations: updatedObservations,
      socialFeedback,
      guidance: {
        ...(old.guidance || {}),
        // Previous editorial guidance survives; absence of an eligible candidate
        // must not erase observed Metricool signals or invent a winning topic.
        performanceRankingEnabled: false,
        metricoolSignalsAvailable: posts.length > 0,
        metricoolLatestSnapshot: snapshot.checkedAt ?? null,
        nextPublicExperiment: "Create a new differentiated post, then compare verified outcomes on the same network and format.",
      },
    },
    added: fresh.length, seen: posts.length, changed: true,
  };
}

async function main() {
  const learningPath = new URL("../garden/gerard-learning.json", import.meta.url);
  const snapshotPath = new URL("../garden/metricool-analytics-snapshot.json", import.meta.url);
  const old = JSON.parse(await readFile(learningPath, "utf8"));
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const { learning, added, seen, changed } = applyMetricoolFeedback(old, snapshot);
  if (changed) await writeFile(learningPath, JSON.stringify(learning, null, 2) + "\n");
  console.log(JSON.stringify({
    status: learning.socialFeedback?.status || "unknown",
    verifiedPosts: seen,
    newHistoricalMeasurements: added,
    asOf: learning.socialFeedback?.snapshotCheckedAt || null,
    rankingEnabled: learning.guidance?.performanceRankingEnabled === true,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
