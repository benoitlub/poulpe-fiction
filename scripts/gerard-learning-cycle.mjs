#!/usr/bin/env node
/** Retain a traceable experiment across cycles; provider analytics are reconciled separately. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { integrateOwnerFeedback } from './gerard-owner-feedback.mjs';

const accepted = new Set(['queued', 'published', 'sent']);
const rejected = new Set(['failed', 'error', 'rejected']);
const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function integrateLearningCycle(previous, decision, publication, analytics, publisher, now = new Date().toISOString()) {
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  const d = decision ?? {};
  const p = publication ?? {};
  const a = analytics ?? {};
  const delivery = p.delivery ?? { status: 'not-attempted' };
  const status = delivery.status ?? 'not-attempted';
  const identity = clean(d.harvestId) ?? clean(d.seedId) ?? null;
  const experiment = clean(d.deliberation?.chosen?.id) ?? 'new-angle';
  const outcome = accepted.has(status) ? 'transport-accepted' : rejected.has(status) ? 'transport-failed' : 'not-verified';
  const observation = {
    kind: 'gerard-experiment-cycle', observedAt: now, seedId: d.seedId ?? null,
    harvestId: d.harvestId ?? null, copyText: d.copyText ?? null,
    repeatCount: d.previousSelectionsOfSameCopy ?? 0,
    chosenExperiment: experiment, experimentHypothesis: d.deliberation?.chosen?.hypothesis ?? null,
    delivery, outcome, metricsStatus: a.status ?? 'unavailable',
    lesson: outcome === 'transport-failed' ? 'Transport failed: inspect the connection before retrying.'
      : outcome === 'transport-accepted' ? 'Transport accepted, audience outcome remains unverified until provider metrics are linked.'
      : 'No confirmed delivery: avoid claims of publication or audience response.',
  };
  const observations = Array.isArray(old.observations) ? old.observations : [];
  const last = observations.at(-1);
  const duplicate = last?.kind === observation.kind && last.harvestId === observation.harvestId &&
    last.seedId === observation.seedId && last.chosenExperiment === experiment &&
    last.outcome === outcome && JSON.stringify(last.delivery) === JSON.stringify(delivery);
  const pending = Array.isArray(old.pendingExperiments) ? old.pendingExperiments : [];
  const pendingKey = identity ? `${identity}|${experiment}` : null;
  let nextPending = pending;
  if (pendingKey && outcome === 'transport-accepted') {
    nextPending = [...pending.filter(item => item.key !== pendingKey), {
      key: pendingKey, seedId: d.seedId ?? null, harvestId: d.harvestId ?? null,
      hypothesis: observation.experimentHypothesis, transportStatus: status,
      startedAt: pending.find(item => item.key === pendingKey)?.startedAt ?? now,
      assessment: 'awaiting-verified-attributed-metrics',
    }].slice(-30);
  }
  const guidance = {
    ...(old.guidance ?? {}), seedId: d.seedId ?? old.guidance?.seedId ?? null,
    chosenExperiment: experiment,
    nextExperiment: outcome === 'transport-failed' ? 'Diagnose failed transport before another attempt.'
      : (d.previousSelectionsOfSameCopy ?? 0) > 0 ? 'Test a distinct creative angle; keep earlier posts unchanged.'
      : 'Explore an angle, observe actual delivery and await comparable verified analytics.',
    performanceRankingEnabled: false,
  };
  return {
    ...old, updatedAt: now,
    observations: (duplicate ? observations : [...observations, observation]).slice(-150),
    pendingExperiments: nextPending,
    publisherAdvice: publisher ?? old.publisherAdvice ?? {},
    guidance,
  };
}

async function main() {
  const garden = new URL('../garden/', import.meta.url);
  const read = async (filename, fallback = {}) => {
    try { return JSON.parse(await readFile(new URL(filename, garden), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  };
  const cycleResult = integrateLearningCycle(
    await read('gerard-learning.json'), await read('gerard-decision-explanation.json'),
    await read('next-social-publication.json'), await read('metricool-analytics-snapshot.json'),
    await read('gerard-publisher-advice.json'));
  const result = integrateOwnerFeedback(cycleResult, await read('gerard-owner-feedback.json', { feedback: [] }));
  await writeFile(new URL('gerard-learning.json', garden), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'integrated', pendingExperiments: result.pendingExperiments.length,
    nextExperiment: result.guidance.nextExperiment }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
