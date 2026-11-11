#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeMission, runSwarm } from './ploustroid-swarm.mjs';
const dir = resolve(process.env.GERARD_PRIVATE_GARDEN_PATH || 'garden');
const read = async name => { try { return JSON.parse(await readFile(resolve(dir, name), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } };
const decision = await read('gerard-social-decision.json');
const publication = await read('gerard-social-publication.json');
const id = decision.harvestId ?? decision.seedId ?? decision.parcelId;
const mission = id ? makeMission({ id: 'diffusion-review:' + id, parcelId: String(id),
  copyText: decision.copyText, visual: decision.visual ?? publication.visual,
  delivery: decision.transport ?? publication.transport }) : null;
const result = mission ? await runSwarm(mission) : { status: 'no-mission', publicationAttempted: false, results: [] };
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, 'ploustroid-swarm-last-run.json'), JSON.stringify({ observedAt: new Date().toISOString(), ...result }, null, 2) + '\n');
console.log(JSON.stringify({ event: 'ploustroid.swarm-review', status: result.status, roles: result.results.map(r => ({ role: r.role, ready: r.ready })), publicationAttempted: false }));
