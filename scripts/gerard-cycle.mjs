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

function decideMode(date = new Date()) {
  const forced = process.env.GERARD_MODE?.trim();
  if (forced && ["dream", "cultivate", "play", "rest"].includes(forced)) return forced;
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 6) return "dream";
  if (hour >= 6 && hour < 12) return "cultivate";
  if (hour >= 12 && hour < 18) return "play";
  return "rest";
}

const MODE_INTENTS = {
  dream: { title: "Gérard rêve", objective: "Explorer librement des associations d'idées à partir du jardin actuel, sans produire de livrable final.", requiredCapabilities: ["knowledge.search"] },
  cultivate: { title: "Gérard récolte une parcelle", objective: "Faire avancer une graine existante du jardin vers une récolte réelle et exploitable.", requiredCapabilities: [] },
  play: { title: "Gérard joue", objective: "Tester une idée exploratoire à faible enjeu, sans engager de ressource coûteuse.", requiredCapabilities: ["knowledge.search"] },
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
  return seeds[(index + 1) % seeds.length];
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
  const mode = decideMode();
  const intent = MODE_INTENTS[mode];
  const state = await loadState();
  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.start", mode, publisherUrl: PUBLISHER_URL }));

  if (mode === "rest") {
    state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, result: "skipped" }];
    state.lastMode = mode; state.lastRunAt = nowIso(); await saveState(state);
    console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.skip", mode })); return;
  }

  const operationId = `gerard-${mode}-${Date.now()}`;
  let result;
  if (mode === "cultivate") {
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

  state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, operationId, result: result.status }];
  state.lastMode = mode; state.lastRunAt = nowIso(); state.lastResult = result; await saveState(state);
  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.done", mode, result }));
  if (result.status !== "ok") process.exitCode = 1;
}

await main();
