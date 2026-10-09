#!/usr/bin/env node
/**
 * Cycle autonome de Gérard — version headless (Node), sans navigateur.
 *
 * CULTIVATE déclenche le vrai moteur de tentacules Neon du Publisher Worker
 * déployé sur Cloudflare. L'API Express locale de blacklace-publisher-ai ne
 * porte pas les routes /api/tentacles/* et ne doit donc pas être utilisée.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = new URL("../garden/gerard-state.json", import.meta.url);
const SEEDS_PATH = new URL("../garden/restart-seeds.json", import.meta.url);
const HARVESTS_PATH = new URL("../garden/harvests.json", import.meta.url);

const OCTOPUS_URL = (process.env.OCTOPUS_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const PUBLISHER_URL = (process.env.PUBLISHER_URL || "https://blacklace-publisher-worker.benoitlubert.workers.dev").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;

function nowIso() { return new Date().toISOString(); }

function decideMode(state = {}, inventory = {}) {
  const forced = process.env.GERARD_MODE?.trim();
  if (forced && ["dream", "cultivate", "play", "symbiosis", "rest"].includes(forced)) {
    return { mode: forced, reason: "manual-override" };
  }
  const history = Array.isArray(state.history) ? state.history : [];
  const recent = history.slice(-8);
  const lastMode = history.at(-1)?.mode;
  const backlog = inventory.activeHarvests ?? 0;
  const seedCount = inventory.seedCount ?? 0;
  const lastCultivate = [...recent].reverse().findIndex(x => x.mode === "cultivate");
  const lastSymbiosis = [...recent].reverse().findIndex(x => x.mode === "symbiosis");

  // Delivery-first: never spend repeated scheduled cycles dreaming or playing
  // while there are harvests to review or seeds awaiting cultivation.
  // Publisher/Metricool scheduling is handled by existing downstream steps;
  // this selector must never invent or trigger a new publication.
  if (backlog > 0 && (lastSymbiosis < 0 || lastSymbiosis >= 2 || lastMode === "cultivate")) {
    return { mode: "symbiosis", reason: "delivery-backlog-priority", backlog };
  }
  if (seedCount > 0) {
    return { mode: "cultivate", reason: "deliverable-production-priority", backlog, seedCount };
  }
  if (backlog > 0) return { mode: "symbiosis", reason: "delivery-review", backlog };
  // No useful work in inventory: exploration is allowed but not assumed to
  // be learning unless its output is independently assessed.
  const creative = recent.filter(x => x.mode === "dream" || x.mode === "play").length;
  if (creative >= 1) return { mode: "rest", reason: "no-work-avoid-unmeasured-creative-loops" };
  return { mode: "dream", reason: "idle-single-exploration" };
}

async function loadInventory() {
  let seedCount = 0;
  let activeHarvests = 0;
  try { seedCount = (await loadSeeds()).length; } catch (_) {}
  try {
    const data = JSON.parse(await readFile(HARVESTS_PATH, "utf8"));
    activeHarvests = (Array.isArray(data.harvests) ? data.harvests : [])
      .filter(x => x?.state !== "archived" && x?.state !== "composted" && typeof x?.content === "string" && x.content.trim()).length;
  } catch (_) {}
  return { seedCount, activeHarvests };
}

const MODE_INTENTS = {
  dream: { title: "Gérard rêve", objective: "Explorer librement des associations d'idées à partir du jardin actuel, sans produire de livrable final.", requiredCapabilities: ["knowledge.search"] },
  cultivate: { title: "Gérard récolte une parcelle", objective: "Faire avancer une graine existante du jardin vers une récolte réelle et exploitable.", requiredCapabilities: [] },
  play: { title: "Gérard joue", objective: "Tester une idée exploratoire à faible enjeu, sans engager de ressource coûteuse.", requiredCapabilities: ["knowledge.search"] },
  symbiosis: { title: "Gérard et Publisher font le point", objective: "Réconcilier localement les récoltes et préparer les prochaines décisions sans publication ni appel IA.", requiredCapabilities: [] },
  rest: { title: "Gérard se repose", objective: "Aucune action requise pour ce cycle.", requiredCapabilities: [] },
};

async function loadState() {
  try { return JSON.parse(await readFile(STATE_PATH, "utf8")); }
  catch (_) { return { history: [] }; }
}

async function loadSeeds() {
  const parsed = JSON.parse(await readFile(SEEDS_PATH, "utf8"));
  return Array.isArray(parsed?.seeds) ? parsed.seeds.filter((seed) => seed?.seedId && seed?.parcelId && seed?.knowledgeSlug) : [];
}

function selectSeedForRotation(seeds, state) {
  if (!seeds.length) return null;
  const lastSeedId = state?.lastSeedId ?? null;
  const index = Math.max(-1, seeds.findIndex((seed) => seed.seedId === lastSeedId));
  const rotated = [...seeds.slice(index + 1), ...seeds.slice(0, index + 1)];
  // Learn from recent operational failures: temporarily try another seed
  // rather than blindly retrying the same failing parcel on each cycle.
  // A single failure is enough for one rotation, not a permanent blacklist.
  const recent = Array.isArray(state?.learningHistory) ? state.learningHistory.slice(-8) : [];
  const lastBySeed = new Map();
  for (const entry of recent) {
    if (entry?.seedId) lastBySeed.set(entry.seedId, entry);
  }
  return rotated.find(seed => lastBySeed.get(seed.seedId)?.outcome !== "failed") ?? rotated[0];
}

async function saveState(state) {
  await mkdir(new URL("../garden/", import.meta.url), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function saveHarvest(selectedSeed, harvest, operationId) {
  const output = harvest?.payload?.output ?? {};
  const text = typeof output?.text === "string" ? output.text.trim() : "";
  if (harvest?.status !== "ok" || !text) return null;

  let existing = { harvests: [] };
  try { existing = JSON.parse(await readFile(HARVESTS_PATH, "utf8")); } catch (_) {}
  const harvests = Array.isArray(existing?.harvests) ? existing.harvests : [];
  const item = {
    harvestId: operationId + "-harvest",
    harvestedAt: nowIso(),
    seedId: selectedSeed.seedId,
    parcelId: selectedSeed.parcelId,
    title: selectedSeed.title ?? selectedSeed.seedId,
    content: text,
    capability: output.capability ?? "content.generate",
    producer: output.producer ?? null,
    route: "octopus->publisher-adapter",
    delivery: selectedSeed.delivery ?? null,
    state: selectedSeed.delivery?.harvestState ?? "harvested",
  };
  await mkdir(new URL("../garden/", import.meta.url), { recursive: true });
  await writeFile(HARVESTS_PATH, JSON.stringify({ harvests: [...harvests.slice(-99), item] }, null, 2) + "\n", "utf8");
  return item;
}

async function runSymbiosis(state) {
  // Local, read-only reconciliation: no LLM, no external API, no publishing.
  let harvests = [];
  try {
    const data = JSON.parse(await readFile(HARVESTS_PATH, "utf8"));
    harvests = Array.isArray(data.harvests) ? data.harvests : [];
  } catch (_) {}
  const seen = new Set();
  const duplicates = [];
  const candidates = [];
  for (const item of harvests) {
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!content) continue;
    const key = content.toLocaleLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) { duplicates.push(item.harvestId ?? null); continue; }
    seen.add(key);
    if (item.state !== "archived" && item.state !== "composted") {
      candidates.push({ harvestId: item.harvestId ?? null, parcelId: item.parcelId ?? null, state: item.state ?? "harvested" });
    }
  }
  // Publisher provides a separate view of publishable candidates.
  // Read-only and fail-open: a network error must not break the garden cycle.
  let publisher = { status: "unavailable", candidateCount: null };
  try {
    const response = await callJson(`${PUBLISHER_URL}/api/social/publication/candidate-plans?limit=10`);
    if (response.status === "ok") {
      const payload = response.payload;
      const items = Array.isArray(payload) ? payload
        : Array.isArray(payload?.candidates) ? payload.candidates
        : Array.isArray(payload?.plans) ? payload.plans : null;
      publisher = items
        ? { status: "observed", candidateCount: items.length, candidateHarvestIds: items.map(x => x?.harvestId).filter(Boolean).slice(0, 10) }
        : { status: "unrecognized-response", candidateCount: null };
    } else {
      publisher = { status: "unavailable", httpStatus: response.httpStatus ?? null, candidateCount: null };
    }
  } catch (error) {
    publisher = { status: "unavailable", candidateCount: null, error: String(error).slice(0, 120) };
  }
  const report = {
    at: nowIso(), mode: "symbiosis", status: "ok",
    scope: "local-harvest-inventory-only",
    publisherReconciliation: publisher.status === "observed" ? "candidate-inventory-only" : "not-verified",
    publisher,
    totalHarvests: harvests.length, uniqueContent: seen.size,
    duplicateCount: duplicates.length, duplicateHarvestIds: duplicates.slice(0, 20),
    candidateCount: candidates.length, candidateSample: candidates.slice(-10),
    action: "observe-only", aiCalls: 0, externalCalls: 1,
    note: "Aucune suppression, aucun compost automatique et aucune publication. L'état réel de Publisher nécessite une vérification distincte."
  };
  await writeFile(new URL("../garden/symbiosis-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n", "utf8");
  state.lastSymbiosis = { at: report.at, duplicateCount: report.duplicateCount, candidateCount: report.candidateCount };
  return report;
}

async function callJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) }, signal: controller.signal });
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; } catch (_) { payload = { status: "unknown", raw }; }
    return { status: response.ok ? "ok" : "failed", httpStatus: response.status, payload };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timer); }
}

async function callOctopus(mission) {
  return callJson(`${OCTOPUS_URL}/mission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mission) });
}

async function runRealHarvest(selectedSeed, knowledgeOutput, operationId) {
  const prompt = [
    selectedSeed.firstHarvest || selectedSeed.objective || "Produire une récolte utile et directement exploitable.",
    "",
    "Contexte vérifié de la parcelle :",
    String(knowledgeOutput?.context || knowledgeOutput?.text || "").trim(),
    "",
    "Contraintes : utilise uniquement ce contexte vérifié. N'invente aucun fait manquant.",
  ].join("\n").trim();

  const mission = {
    operationId: `${operationId}-harvest`,
    title: `Récolte · ${selectedSeed.title ?? selectedSeed.seedId}`,
    objective: selectedSeed.objective || "Produire une récolte exploitable.",
    prompt,
    requiredCapabilities: ["content.generate"],
    authorizedResources: [],
    context: {
      id: selectedSeed.parcelId,
      label: selectedSeed.title ?? selectedSeed.parcelId,
      objective: selectedSeed.objective || "",
      metadata: {
        source: "gerard-cycle",
        mode: "cultivate",
        seedId: selectedSeed.seedId,
        parcelId: selectedSeed.parcelId,
        knowledgeSlug: selectedSeed.knowledgeSlug,
        delivery: selectedSeed.delivery ?? null,
      },
    },
  };

  const result = await callOctopus(mission);
  const payload = result?.payload ?? {};
  const output = payload?.output ?? {};
  const text = typeof output?.text === "string" ? output.text.trim() : "";
  const completed = result.status === "ok" && payload.status === "completed" && text.length > 0;

  return {
    ...result,
    status: completed ? "ok" : "failed",
    verification: {
      seedId: selectedSeed.seedId,
      parcelId: selectedSeed.parcelId,
      operationId: mission.operationId,
      capability: output?.capability ?? "content.generate",
      completed,
      contentLength: text.length,
      producer: output?.producer ?? null,
      route: "octopus->publisher-adapter",
    },
  };
}

async function main() {
  const state = await loadState();
  const decision = decideMode(state, await loadInventory());
  const mode = decision.mode;
  const intent = MODE_INTENTS[mode];
  state.lastDecision = { at: nowIso(), ...decision };
  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.start", mode, reason: decision.reason, publisherUrl: PUBLISHER_URL }));

  if (mode === "rest") {
    state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, result: "skipped" }];
    state.lastMode = mode; state.lastRunAt = nowIso(); await saveState(state);
    console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.skip", mode })); return;
  }

  const operationId = `gerard-${mode}-${Date.now()}`;
  let result;
  if (mode === "symbiosis") {
    result = await runSymbiosis(state);
  } else if (mode === "cultivate") {
    const seeds = await loadSeeds();
    const selectedSeed = selectSeedForRotation(seeds, state);
    if (!selectedSeed) {
      result = { status: "failed", operationId, decision: "no-active-seed" };
    } else {
      const knowledgeMission = {
        operationId: `${operationId}-knowledge`,
        title: `Préparer le contexte de culture · ${selectedSeed.title ?? selectedSeed.seedId}`,
        objective: selectedSeed.objective ?? intent.objective,
        requiredCapabilities: ["knowledge.search"],
        authorizedResources: [],
        context: {
          id: selectedSeed.parcelId,
          label: selectedSeed.title ?? selectedSeed.parcelId,
          objective: selectedSeed.objective ?? intent.objective,
          metadata: {
            source: "gerard-cycle",
            mode,
            seedId: selectedSeed.seedId,
            parcelId: selectedSeed.parcelId,
            knowledgeSlug: selectedSeed.knowledgeSlug,
            gardenStage: "prepare-bag",
            delivery: selectedSeed.delivery ?? null,
          },
        },
      };
      const knowledgeResult = await callOctopus(knowledgeMission);
      const knowledgePayload = knowledgeResult?.payload ?? {};
      const knowledgeOutput = knowledgePayload?.output ?? {};
      const knowledgeReady = knowledgeResult.status === "ok" && knowledgePayload.status === "completed" && knowledgeOutput.verified === true;

      result = {
        status: knowledgeReady ? "ok" : "failed",
        harvestMode: "garden-prepare-bag",
        operationId,
        seedId: selectedSeed.seedId,
        parcelId: selectedSeed.parcelId,
        phase: "knowledge",
        knowledge: {
          status: knowledgePayload.status ?? knowledgeResult.status,
          verified: knowledgeOutput.verified === true,
          slug: knowledgeOutput.slug ?? selectedSeed.knowledgeSlug,
          source: knowledgeOutput.source ?? null,
        },
        delivery: selectedSeed.delivery ?? null,
        decision: knowledgeReady ? "knowledge-ready" : "knowledge-unavailable",
        octopus: knowledgeResult,
      };

      if (knowledgeReady) {
        const harvest = await runRealHarvest(selectedSeed, knowledgeOutput, operationId);
        result.harvest = harvest;
        if (harvest.status === "ok") result.persistedHarvest = await saveHarvest(selectedSeed, harvest, operationId);
        result.status = harvest.status === "ok" ? "ok" : "failed";
        result.decision = harvest.status === "ok"
          ? (selectedSeed.delivery?.harvestState === "ready-to-offer" ? "harvest-ready-to-offer" : "harvest-produced")
          : "harvest-failed";
      }
      state.lastSeedId = selectedSeed.seedId;
    }
  } else {
    result = await callOctopus({ operationId, parcelId: "poulpe-fiction", title: intent.title, objective: intent.objective, requiredCapabilities: intent.requiredCapabilities, context: { id: "poulpe-fiction", label: "Poulpe Fiction", objective: intent.objective, metadata: { source: "gerard-cycle", mode } } });
  }

  // Retain a bounded learning trail: attempts, outcomes and causes, not just successes.
  // No additional model call and no extra Metricool publication are needed.
  const learningEntry = {
    at: nowIso(), operationId, mode, intention: intent.objective,
    outcome: result.status, decision: result.decision ?? null,
    seedId: result.seedId ?? null, parcelId: result.parcelId ?? null,
    error: result.status === "ok" ? null :
      String(result.error ?? result.decision ?? result.harvest?.error ?? "operation-failed").slice(0, 500),
    feedback: result.status === "ok" ? "observe-downstream-results" : "avoid-blind-retry",
  };
  state.learningHistory = [...(Array.isArray(state.learningHistory) ? state.learningHistory : []).slice(-49), learningEntry];
  state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, reason: decision.reason, operationId, result: result.status }];
  state.lastMode = mode; state.lastRunAt = nowIso(); state.lastResult = result; await saveState(state);
  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.done", mode, result }));
  if (result.status !== "ok") process.exitCode = 1;
}

await main();
