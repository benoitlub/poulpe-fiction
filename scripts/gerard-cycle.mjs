#!/usr/bin/env node
/**
 * Cycle autonome de Gérard — version headless (Node), sans navigateur.
 *
 * Le cycle de CULTURE ne fabrique pas un faux "article" pour simuler une
 * récolte : il déclenche le vrai moteur de tentacules Neon du Publisher.
 * Octopus reste le cerveau neutre pour les modes dream/play, mais la récolte
 * doit provenir de /api/tentacles/run-cycle.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = new URL("../garden/gerard-state.json", import.meta.url);

const OCTOPUS_URL = (process.env.OCTOPUS_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const PUBLISHER_URL = (process.env.PUBLISHER_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;

function nowIso() {
  return new Date().toISOString();
}

function decideMode(date = new Date()) {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 6) return "dream";
  if (hour >= 6 && hour < 12) return "cultivate";
  if (hour >= 12 && hour < 18) return "play";
  return "rest";
}

const MODE_INTENTS = {
  dream: {
    title: "Gérard rêve",
    objective: "Explorer librement des associations d'idées à partir du jardin actuel, sans produire de livrable final.",
    requiredCapabilities: ["knowledge.search"],
  },
  cultivate: {
    title: "Gérard récolte une parcelle",
    objective: "Faire avancer une graine existante du jardin vers une récolte réelle et exploitable.",
    requiredCapabilities: [],
  },
  play: {
    title: "Gérard joue",
    objective: "Tester une idée exploratoire à faible enjeu, sans engager de ressource coûteuse.",
    requiredCapabilities: ["knowledge.search"],
  },
  rest: {
    title: "Gérard se repose",
    objective: "Aucune action requise pour ce cycle.",
    requiredCapabilities: [],
  },
};

async function loadState() {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return { history: [] };
  }
}

async function saveState(state) {
  await mkdir(new URL("../garden/", import.meta.url), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function callJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_) {
      payload = { status: "unknown", raw };
    }
    return {
      status: response.ok ? "ok" : "failed",
      httpStatus: response.status,
      payload,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callOctopus(mission) {
  return callJson(`${OCTOPUS_URL}/mission`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mission),
  });
}

async function runRealHarvest() {
  // This is the real server-side Neon tentacle loop already implemented in
  // blacklace-publisher-ai. It produces tentacle_iterations rows containing
  // actual Mistral content and, when available, a real visual_url. It is not
  // an article-writing proxy and must not be replaced by content.article.write.
  return callJson(`${PUBLISHER_URL}/api/tentacles/run-cycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "poulpe-fiction-gerard-cycle" }),
  });
}

async function main() {
  const mode = decideMode();
  const intent = MODE_INTENTS[mode];
  const state = await loadState();

  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.start", mode }));

  if (mode === "rest") {
    state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, result: "skipped" }];
    state.lastMode = mode;
    state.lastRunAt = nowIso();
    await saveState(state);
    console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.skip", mode }));
    return;
  }

  const operationId = `gerard-${mode}-${Date.now()}`;
  let result;

  if (mode === "cultivate") {
    // IMPORTANT: cultivate means a real harvest. Do not route this through
    // content.article.write: that previously produced a generic guide and
    // falsely looked like a successful harvest in gerard-state.json.
    result = await runRealHarvest();
    result = {
      ...result,
      harvestMode: "neon-tentacle-cycle",
      operationId,
    };
  } else {
    const mission = {
      operationId,
      parcelId: "poulpe-fiction",
      title: intent.title,
      objective: intent.objective,
      requiredCapabilities: intent.requiredCapabilities,
      context: {
        id: "poulpe-fiction",
        label: "Poulpe Fiction",
        objective: intent.objective,
        metadata: { source: "gerard-cycle", mode },
      },
    };
    result = await callOctopus(mission);
  }

  state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, operationId, result: result.status }];
  state.lastMode = mode;
  state.lastRunAt = nowIso();
  state.lastResult = result;
  await saveState(state);

  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.done", mode, result }));

  if (result.status !== "ok") {
    process.exitCode = 1;
  }
}

await main();
