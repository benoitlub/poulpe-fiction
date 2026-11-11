#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { diagnosePublication, analyticsHealth } from './gerard-publication-diagnostics.mjs';
const dir = resolve(process.env.GERARD_PRIVATE_GARDEN_PATH || 'garden');
async function read(name) { try { return JSON.parse(await readFile(resolve(dir, name), 'utf8')); } catch(e) { if(e.code === 'ENOENT') return {}; throw e; } }
const [candidate, learning, advice] = await Promise.all([read('next-social-publication.json'), read('gerard-learning.json'), read('gerard-publisher-advice.json')]);
const result = { at: new Date().toISOString(),
  publication: diagnosePublication(candidate, { bufferTokenPresent: Boolean(process.env.BUFFER_DRAFT_WRITE_TOKEN) }),
  analytics: analyticsHealth(advice, learning.socialFeedback) };
await writeFile(resolve(dir, 'gerard-publication-diagnostics.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ event: 'gerard.publication-diagnostics', ...result }));
