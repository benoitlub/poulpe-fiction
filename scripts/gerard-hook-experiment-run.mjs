#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { planHookExperiment, recordHookExperiment } from './gerard-hook-experiments.mjs';
const dir = resolve(process.env.GERARD_PRIVATE_GARDEN_PATH || 'garden');
async function read(name) {
  try { return JSON.parse(await readFile(resolve(dir, name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
const decision = await read('gerard-social-decision.json');
const state = await read('gerard-learning.json');
const experiment = planHookExperiment(decision, state);
const next = recordHookExperiment(state, experiment);
if (next !== state) await writeFile(resolve(dir, 'gerard-learning.json'), JSON.stringify(next, null, 2) + '\n');
console.log(JSON.stringify({ event: 'gerard.hook-hypothesis', status: experiment.status, angle: experiment.angle ?? null, metrics: experiment.metrics ?? [] }));
