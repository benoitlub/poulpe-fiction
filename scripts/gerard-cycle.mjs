#!/usr/bin/env node
/**
 * Cycle autonome de Gérard — version headless (Node), sans navigateur.
 *
 * Remplace la logique qui vivait auparavant dans gerard-autonomy.js (browser-only,
 * localStorage, visibilitychange) et dans .github/workflows/gerard-autonomous.yml
 * (retiré d'Octopus Engine par l'ADR-0008 : ce cycle appartient à Poulpe Fiction,
 * pas au moteur neutre).
 *
 * Ce script :
 *  1. Décide le mode du cycle (dream / cultivate / play) selon l'heure UTC.
 *  2. Construit une mission neutre et l'envoie à Octopus Engine (`POST /mission`).
 *  3. Persiste un état minimal (dernier mode, dernier run, dernier résultat) dans
 *     garden/gerard-state.json, committé par le workflow — pas de localStorage.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = new URL("../garden/gerard-state.json", import.meta.url);

const OCTOPUS_URL = (process.env.OCTOPUS_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
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
    title: "Gérard cultive une parcelle",
    objective: "Faire avancer une graine existante du jardin vers une récolte exploitable.",
    requiredCapabilities: ["content.article.write"],
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

async function callOctopus(mission) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${OCTOPUS_URL}/mission`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(mission),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_) {
      payload = { status: "unknown", raw };
    }
    if (!response.ok) {
      return { status: "failed", httpStatus: response.status, payload };
    }
    return { status: "ok", httpStatus: response.status, payload };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const mode = decideMode();
  const intent = MODE_INTENTS[mode];
  const state = await loadState();

  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.start", mode }));

  if (mode === "rest" || intent.requiredCapabilities.length === 0) {
    state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, result: "skipped" }];
    state.lastMode = mode;
    state.lastRunAt = nowIso();
    await saveState(state);
    console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.skip", mode }));
    return;
  }

  const operationId = `gerard-${mode}-${Date.now()}`;
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

  const result = await callOctopus(mission);

  state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, operationId, result: result.status }];
  state.lastMode = mode;
  state.lastRunAt = nowIso();
  state.lastResult = result;
  await saveState(state);

  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.done", mode, result }));

  if (result.status === "error") {
    process.exitCode = 1;
  }
}

await main();
