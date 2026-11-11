#!/usr/bin/env node
/** Retain a traceable experiment across cycles; provider analytics are reconciled separately. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { recordEvent, adviseNextDecision } from './gerard-adaptive-hooks.mjs';
import { observeDiffusionMission } from './ploustroid-observer.mjs';
import { integrateOwnerFeedback } from './gerard-owner-feedback.mjs';
import { editorialMix, suggestEditorialCategory } from './gerard-editorial-mix.mjs';

const accepted = new Set(['queued', 'published', 'sent']);
const rejected = new Set(['failed', 'error', 'rejected']);
export function deliveryOutcome(delivery = {}) {
  const status = delivery.status ?? 'not-attempted';
  if (accepted.has(status)) return 'transport-accepted';
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
  const delivery = p.delivery ?? { status: 'not-attempted' };
  const status = delivery.status ?? 'not-attempted';
  const identity = clean(d.harvestId) ?? clean(d.seedId) ?? null;
  const experiment = clean(d.deliberation?.chosen?.id) ?? 'new-angle';
  const outcome = deliveryOutcome(delivery);
  const observation = {
    kind: 'gerard-experiment-cycle', observedAt: now, seedId: d.seedId ?? null,
    harvestId: d.harvestId ?? null, copyText: d.copyText ?? null,
    repeatCount: d.previousSelectionsOfSameCopy ?? 0,
    chosenExperiment: experiment, experimentHypothesis: d.deliberation?.chosen?.hypothesis ?? null,
    delivery, outcome, metricsStatus: a.status ?? 'unavailable',
    lesson: outcome === 'transport-blocked' ? 'Transport was blocked before delivery: restore access; audience outcome remains unknown.'
      : outcome === 'transport-failed' ? 'Transport failed: inspect the connection before retrying.'
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

// Opt-in adapter: stores only minimal operational evidence inside the existing
// private learning document, which is already restored/persisted by the runtime.
// No publication, scheduling, or network side effects.
export function integrateAdaptiveEvidence(learning, decision, publication, now = new Date().toISOString()) {
  const parcelId = typeof decision?.parcelId === 'string' ? decision.parcelId.trim() : '';
  const cycleId = String(decision?.operationId ?? decision?.cycleId ?? '').trim();
  const status = publication?.delivery?.status;
  if (!parcelId || !cycleId || typeof status !== 'string' || !status.trim()) {
    return { ...learning, adaptiveEvidence: { ...(learning?.adaptiveEvidence ?? {}), status: 'insufficient-evidence' } };
  }
  const prior = learning?.adaptiveEvents ?? { events: [] };
  const eventId = `delivery:${parcelId}:${cycleId}`;
  const existing = prior.events?.find(e => e.eventId === eventId);
  const event = existing ?? {
    eventId, cycleId, parcelId, kind: 'delivery', at: now,
    payload: { status, providerStatus: publication.delivery?.providerStatus ?? null },
  };
  const next = recordEvent(prior, event);
  const advice = adviseNextDecision(next, parcelId);
  return { ...learning, adaptiveEvents: { events: next.events.slice(-150) },
    adaptiveEvidence: { status: 'observed', parcelId, cycleId, advice, updatedAt: now } };
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
  const ownerResult = integrateOwnerFeedback(cycleResult, await read('gerard-owner-feedback.json', { feedback: [] }));
  // Disabled by default until runtime integration and production validation.
  const result = process.env.GERARD_ADAPTIVE_HOOKS_ENABLED === 'true'
    ? integrateAdaptiveEvidence(ownerResult, await read('gerard-decision-explanation.json'),
        await read('next-social-publication.json')) : ownerResult;
  if (process.env.GERARD_ADAPTIVE_HOOKS_ENABLED === 'true') {
    // Operational evidence only; never log private payloads, post copy or tokens.
    const evidence = result.adaptiveEvidence ?? {};
    console.log(JSON.stringify({
      event: 'gerard.adaptive-observation',
      status: evidence.status ?? 'unavailable',
      eventCount: Array.isArray(result.adaptiveEvents?.events) ? result.adaptiveEvents.events.length : 0,
      cyclePresent: Boolean(evidence.cycleId),
      parcelPresent: Boolean(evidence.parcelId),
      adviceAction: evidence.advice?.action ?? null,
      evidenceCount: evidence.advice?.evidenceIds?.length ?? 0,
    }));
  }
  if (process.env.PLOUSTROID_OBSERVATION_ENABLED === 'true') {
    const observation = observeDiffusionMission(result.ploustroidSquadrons, result.adaptiveEvidence);
    result.ploustroidSquadrons = observation.state;
    console.log(JSON.stringify({ event: 'ploustroid.diffusion-observation', ...observation.summary }));
  }
  await writeFile(new URL('gerard-learning.json', garden), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'integrated', pendingExperiments: result.pendingExperiments.length,
    nextExperiment: result.guidance.nextExperiment }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
