import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Execute the workflow's real selection block with a local curl replacement.
// Never run the complete runtime: later steps can schedule real publications.
const workflow = readFileSync(new URL("../.github/workflows/gerard-runtime.yml", import.meta.url), "utf8");
const start = workflow.indexOf('          EXCLUDED_IDS=""');
const end = workflow.indexOf('          if [ "$HTTP_STATUS" = "200" ]; then', start);
assert.ok(start >= 0 && end > start, "selection block must exist");
const selection = workflow.slice(start, end).replace(/^          /gm, "");

function runSelection(t, files = {}, empty = false) {
  const root = mkdtempSync(join(tmpdir(), "gerard-seed-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "garden"));
  mkdirSync(join(root, "bin"));
  for (const [name, value] of Object.entries(files)) {
    writeFileSync(join(root, "garden", name), JSON.stringify(value));
  }
  // The stub rejects every endpoint except selection and editorial routing.
  writeFileSync(join(root, "bin", "curl"), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const url = new URL(args.find(arg => arg.startsWith('https://')));
const calls = fs.existsSync('calls.json') ? JSON.parse(fs.readFileSync('calls.json')) : [];
calls.push(url.href);
fs.writeFileSync('calls.json', JSON.stringify(calls));
let body;
let status = '200';
if (url.origin !== 'https://publisher.invalid') process.exit(2);
if (url.pathname === '/api/social/bridge/next') {
  if (process.env.EMPTY_SELECTION === 'true') {
    body = { status: 'empty' }; status = '404';
  } else {
    const alternative = url.searchParams.get('excludeHarvestIds').split(',').includes('book-1');
    body = { status: 'ready', harvestId: alternative ? 'creative-1' : 'book-1', seedId: alternative ? 'creative' : 'book', copy: { text: 'Ready copy' } };
  }
} else if (url.pathname === '/api/social/editorial/route') {
  const input = JSON.parse(args[args.indexOf('--data') + 1]);
  body = { destination: { preferredProvider: input.seedId === 'book' ? 'buffer' : 'metricool' } };
} else process.exit(3);
fs.writeFileSync(args[args.indexOf('--output') + 1], JSON.stringify(body));
process.stdout.write(status);
`, { mode: 0o755 });
  const script = selection.replaceAll("/tmp/gerard-", `${root}/gerard-`);
  const result = spawnSync("bash", ["-eu", "-o", "pipefail", "-c", script], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, PUBLISHER_URL: "https://publisher.invalid", EMPTY_SELECTION: String(empty) },
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = JSON.parse(readFileSync(join(root, "calls.json"), "utf8")).map(url => new URL(url));
  return {
    selections: calls.filter(url => url.pathname === "/api/social/bridge/next"),
    calls,
    candidate: JSON.parse(readFileSync(join(root, "gerard-social-next.json"), "utf8")),
  };
}

function assertSeeds(result, expected) {
  assert.equal(result.selections.length, 2, "must exercise the first call and a Buffer alternative");
  for (const url of result.selections) {
    assert.deepEqual(new Set(url.searchParams.get("excludeSeedIds").split(",")), new Set(expected));
  }
  assert.ok(result.selections[1].searchParams.get("excludeHarvestIds").split(",").includes("book-1"));
  assert.equal(result.candidate.harvestId, "creative-1");
}

test("rested 420 seed survives alternative selection without any local harvest file", t => {
  assertSeeds(runSelection(t), ["420-dice"]);
});

test("all locally known 420 harvests and the historic fallback are retained", t => {
  const result = runSelection(t, { "harvests.json": [
    { seedId: "420-dice", harvestId: "420-new" },
    { seedId: "420-dice", id: "420-old" },
    { seedId: "other", id: "other-id" },
  ] });
  assertSeeds(result, ["420-dice"]);
  const ids = result.selections[0].searchParams.get("excludeHarvestIds").split(",");
  for (const id of ["420-new", "420-old", "harvest_local_harvest_420-dice_1786215725387"]) assert.ok(ids.includes(id));
  assert.ok(!ids.includes("other-id"));
});

test("three repeated selections exclude the seed even without a local inventory", t => {
  assertSeeds(runSelection(t, {
    "gerard-decision-history.json": Array.from({ length: 3 }, () => ({ seedId: "feuch-dice" })),
  }), ["420-dice", "feuch-dice"]);
});

test("Gerard's explore decision excludes the previous seed and preserves URL encoding", t => {
  assertSeeds(runSelection(t, {
    "gerard-learning.json": { guidance: { chosenExperiment: "explore", seedId: "seed & test" } },
  }), ["420-dice", "seed & test"]);
});

test("repeat and explore decisions combine independently", t => {
  assertSeeds(runSelection(t, {
    "gerard-decision-history.json": Array.from({ length: 3 }, () => ({ seedId: "feuch-dice" })),
    "gerard-learning.json": { guidance: { chosenExperiment: "explore", seedId: "terra" } },
  }), ["420-dice", "feuch-dice", "terra"]);
});

test("a different experiment and mixed history do not exclude extra seeds", t => {
  assertSeeds(runSelection(t, {
    "gerard-decision-history.json": [{ seedId: "a" }, { seedId: "b" }, { seedId: "a" }],
    "gerard-learning.json": { guidance: { chosenExperiment: "refine", seedId: "terra" } },
  }), ["420-dice"]);
});

test("an empty selection never retries without exclusions or routes a publication", t => {
  const result = runSelection(t, {}, true);
  assert.equal(result.calls.length, 1);
  assert.equal(result.selections[0].searchParams.get("excludeSeedIds"), "420-dice");
  assert.equal(result.candidate.status, "empty");
});
