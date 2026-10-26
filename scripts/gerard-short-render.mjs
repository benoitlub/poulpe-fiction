#!/usr/bin/env node
/** Manual, local-only rendering entry point. Never publishes. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderShort } from './gerard-short-studio.mjs';

if (process.env.GERARD_SHORT_STUDIO_ENABLED !== 'true') {
  console.error('Short Studio disabled. Set GERARD_SHORT_STUDIO_ENABLED=true to render local assets.');
  process.exitCode = 2;
} else {
  const [seedPath, outputDir] = process.argv.slice(2);
  if (!seedPath || !outputDir) {
    console.error('Usage: node scripts/gerard-short-render.mjs <seed.json> <output-directory>');
    process.exitCode = 2;
  } else {
    try {
      const seed = JSON.parse(await readFile(resolve(seedPath), 'utf8'));
      const result = await renderShort(seed, { outputDir: resolve(outputDir) });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(String(error));
      process.exitCode = 1;
    }
  }
}
