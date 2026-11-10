#!/usr/bin/env node
/** Retain a traceable experiment across cycles; provider analytics are reconciled separately. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { integrateAcquisitionFeedback } from './gerard-client-acquisition.mjs';
import { integrateOwnerFeedback } from './gerard-owner-feedback.mjs';
import { editorialMix, suggestEditorialCategory } from './gerard-editorial-mix.mjs';

const accepted = new Set(['queued', 'published', 'sent']);
const rejected = new Set(['failed', 'error', 'rejected']);
export function deliveryOutcome(delivery = {}) {
  const status = delivery.status ?? 'not-attempted';
  if (accepted.has(status) && clean(delivery.postId ?? delivery.providerPostId)) return 'transport-accepted';
  if (status === 'confirmed-scheduled' && (delivery.scheduled === true || delivery.providerStatus === 'scheduled') && clean(delivery.postId)) return 'transport-accepted';
  const postId = delivery.postId ?? delivery.providerPostId;
  if (status === 'confirmed-published' && typeof postId === 'string' && postId.trim() &&
      ['sent', 'published'].includes(delivery.providerStatus)) return 'transport-accepted';
  if (status === 'blocked') return 'transport-blocked';
  return rejected.has(status) ? 'transport-failed' : 'not-verified';
}
const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function integrateLearningCycle(previous, decision, publication, analytics, publisher, now = new Date().toISOString()) {
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  const d = decision ?? {};
  const p = publication ?? {};
  const a = analytics ?? {};
  // A stale explanation must never receive another harvest's delivery result.
  const identityMatches = (!p.harvestId || p.harvestId === d.harvestId) && (!p.seedId || p.seedId === d.seedId);
  const delivery = identityMatches ? p.delivery ?? { status: 'not-attempted' } : { status: 'identity-mismatch' };
  const status = delivery.status ?? 'not-attempted';
  const identity = clean(d.harvestId) ?? clean(d.seedId) ?? null;
  const experiment = clean(d.deliberation?.chosen?.id) ?? 'new-angle';
  const outcome = deliveryOutcome(delivery);
  const observation = {
    kind: 'gerard-experiment-cycle', observedAt: now, decisionAt: d.explainedAt ?? null, seedId: d.seedId ?? null,
    harvestId: d.harvestId ?? null, parcelId: d.parcelId ?? d.seedId ?? null, copyText: d.copyText ?? null,
    repeatCount: d.previousSelectionsOfSameCopy ?? 0,
    chosenExperiment: experiment, experimentHypothesis: d.deliberation?.chosen?.hypothesis ?? null,
    delivery, outcome, metricsStatus: a.status ?? 'unavailable',
    lesson: outcome === 'transport-blocked' ? 'Transport was blocked before delivery: restore access; audience outcome remains unknown.'
      : outcome === 'transport-failed' ? 'Transport failed: inspect the connection before retrying.'
      : outcome === 'transport-accepted' ? 'Transport accepted, audience outcome remains unverified until provider metrics are linked.'
      : 'No confirmed delivery: avoid claims of publication or audience response.',
  };
  const observations = Array.isArray(old.observations) ? old.observations : [];
  const duplicate = observations.some(last => last?.kind === observation.kind && last.harvestId === observation.harvestId &&
    last.seedId === observation.seedId && last.chosenExperiment === experiment &&
    last.outcome === outcome && JSON.stringify(last.delivery) === JSON.stringify(delivery) && last.decisionAt === observation.decisionAt);
  const pending = Array.isArray(old.pendingExperiments) ? old.pendingExperiments : [];
  const pendingKey = identity ? `${identity}|${experiment}` : null;
  let nextPending = pending;
  if (pendingKey && outcome === 'transport-accepted' && !(old.completedExperiments ?? []).some(item => item.key === pendingKey)) {
    nextPending = [...pending.filter(item => item.key !== pendingKey), {
      key: pendingKey, seedId: d.seedId ?? null, parcelId: d.parcelId ?? d.seedId ?? null, harvestId: d.harvestId ?? null, networks: d.chosenNetwork ?? [],
      hypothesis: observation.experimentHypothesis, transportStatus: status,
      startedAt: pending.find(item => item.key === pendingKey)?.startedAt ?? now,
      assessment: 'awaiting-verified-attributed-metrics',
    }].slice(-30);
  }
  // Advisory creative mix: only explicit original creative classifications count.
  // Historical unattributed posts are not silently relabeled as promotional.
  const creativeAssets = Array.isArray(old.editorialAssets) ? old.editorialAssets : [];
  const mix = editorialMix(creativeAssets);
  const suggestedCategory = suggestEditorialCategory(creativeAssets);
  const guidance = {
    ...(old.guidance ?? {}), seedId: d.seedId ?? old.guidance?.seedId ?? null,
    chosenExperiment: experiment,
    nextExperiment: ['transport-failed', 'transport-blocked'].includes(outcome) ? 'Diagnose failed transport before another attempt.'
      : (d.previousSelectionsOfSameCopy ?? 0) > 0 ? 'Test a distinct creative angle; keep earlier posts unchanged.'
      : 'Explore an angle, observe actual delivery and await comparable verified analytics.',
    performanceRankingEnabled: false,
    editorialExperiment: { cycleDays: 30, mix, suggestedCategory, status: 'advisory',
      note: 'Do not edit scheduled posts. Category selection is optional and never gates publishing.' },
  };
  return {
    ...old, updatedAt: now,
    observations: (duplicate ? observations : [...observations, observation]).slice(-150),
    pendingExperiments: nextPending,
    publisherAdvice: publisher ?? old.publisherAdvice ?? {},
    guidance,
  };
}

/** Operational adaptation, never a statistical claim or permanent blacklist. */
export function learningSelectionPolicy(learning, now = Date.now()) {
  const latest = new Map();
  for (const entry of learning?.observations ?? []) {
    if (entry.kind === 'gerard-experiment-cycle' && clean(entry.harvestId) && clean(entry.seedId))
      latest.set(entry.harvestId, entry);
  }
  const evidence = [...latest.values()].filter(entry => {
    const age = now - Date.parse(entry.observedAt);
    return age >= 0 && age < 3 * 60 * 60_000 &&
      ['transport-failed', 'transport-blocked', 'transport-accepted'].includes(entry.outcome);
  }).map(entry => ({ harvestId: entry.harvestId, seedId: entry.seedId, outcome: entry.outcome,
    observedAt: entry.observedAt, reason: entry.outcome === 'transport-accepted' ? 'avoid-duplicate-delivery' : 'retry-other-harvest-before-expiring-retry' }));
  return { excludeHarvestIds: evidence.map(entry => entry.harvestId), evidence, scope: 'exact-harvest', expiresAfterHours: 3, performanceRankingEnabled: false };
}

async function main() {
  const garden = new URL('../garden/', import.meta.url);
  const read = async (filename, fallback = {}) => {
    try { return JSON.parse(await readFile(new URL(filename, garden), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  };
  if (process.argv[2] === '--selection-policy') { console.log(JSON.stringify(learningSelectionPolicy(await read('gerard-learning.json')))); return; }
  const cycleResult = integrateLearningCycle(
    await read('gerard-learning.json'), await read('gerard-decision-explanation.json'),
    await read('next-social-publication.json'), await read('metricool-analytics-snapshot.json'),
    await read('gerard-publisher-advice.json'));
  const reviewed = integrateOwnerFeedback(cycleResult, await read('gerard-owner-feedback.json', { feedback: [] }));
  const result = integrateAcquisitionFeedback(reviewed, await read('gerard-mail-outbox.json', {drafts:[]}));
  await writeFile(new URL('gerard-learning.json', garden), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'integrated', pendingExperiments: result.pendingExperiments.length,
    nextExperiment: result.guidance.nextExperiment }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
