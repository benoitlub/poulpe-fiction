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

async function saveState(state) {
  await mkdir(new URL("../garden/", import.meta.url), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
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

async function runRealHarvest() {
  const startedAt = Date.now();
  const result = await callJson(`${PUBLISHER_URL}/api/tentacles/run-cycle?limit=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "poulpe-fiction-gerard-cycle" }),
  });
  if (result.status !== "ok") return result;

  const processed = Number(result.payload?.processed ?? 0);
  const results = Array.isArray(result.payload?.results) ? result.payload.results : [];
  const completed = results.filter((item) => String(item?.status || "").startsWith("completed")).length;
  if (processed < 1 || completed < 1) {
    return { ...result, status: "failed", verification: { startedAt, processed, completed, reason: "No completed tentacle iteration was produced." } };
  }

  const iterations = await callJson(`${PUBLISHER_URL}/api/tentacles/iterations?limit=10`, { method: "GET", headers: { Accept: "application/json" } });
  const rows = Array.isArray(iterations.payload?.iterations) ? iterations.payload.iterations : [];
  const latest = rows.find((row) => row?.created_at && Date.parse(row.created_at) >= startedAt - 5_000) || rows[0] || null;
  const visualUrl = typeof latest?.visual_url === "string" && latest.visual_url.trim() ? latest.visual_url.trim() : null;

  return {
    ...result,
    verification: {
      startedAt, processed, completed,
      iterationId: latest?.id ?? null,
      seedId: latest?.seed_id ?? null,
      iterationNumber: latest?.iteration_number ?? null,
      visualUrl,
      visualCreated: Boolean(visualUrl),
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
    result = { ...(await runRealHarvest()), harvestMode: "neon-tentacle-cycle", operationId };
  } else {
    result = await callOctopus({ operationId, parcelId: "poulpe-fiction", title: intent.title, objective: intent.objective, requiredCapabilities: intent.requiredCapabilities, context: { id: "poulpe-fiction", label: "Poulpe Fiction", objective: intent.objective, metadata: { source: "gerard-cycle", mode } } });
  }

  state.history = [...(state.history || []).slice(-19), { at: nowIso(), mode, operationId, result: result.status }];
  state.lastMode = mode; state.lastRunAt = nowIso(); state.lastResult = result; await saveState(state);
  console.log(JSON.stringify({ at: nowIso(), event: "gerard-cycle.done", mode, result }));
  if (result.status !== "ok") process.exitCode = 1;
}

await main();
