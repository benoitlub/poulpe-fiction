import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureGarden, hydrateGarden, persistSnapshot, projectGarden } from "../scripts/gerard-private-runtime.mjs";
import { adaptGerard } from "../src/garden-gege/core.mjs";

test("private snapshots round-trip losslessly while public files contain only metadata", async t => {
  const dir = await mkdtemp(join(tmpdir(), "gerard-private-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = { lastMode: "cultivate", lastRunAt: "2026-11-02T12:00:00Z", businessSourceMemory: { secret: "PRIVATE_SOURCE_SENTINEL" },
    history: [{ mode: "cultivate", operationId: "cycle-1", reason: "PRIVATE_SOURCE_SENTINEL", result: "ok" }],
    learningHistory: [{ at: "2026-11-02T12:00:00Z", operationId: "gerard-cycle-1", parcelId: "poulpe-fiction", mode: "cultivate", outcome: "ok", intention: "PRIVATE_SOURCE_SENTINEL" }],
    lastResult: { status: "ok", payload: { output: { context: "PRIVATE_SOURCE_SENTINEL", isMock: true } } } };
  await writeFile(join(dir, "gerard-state.json"), JSON.stringify(source));
  await writeFile(join(dir, "gerard-mail-outbox.json"), JSON.stringify({ drafts: [{ recipient: "private@example.invalid", body: "PRIVATE_SOURCE_SENTINEL" }] }));
  const payload = await captureGarden(dir);
  let row;
  const pool = { query: async (sql, args) => {
    if (sql.startsWith("INSERT")) { row = { version: 1, payload: JSON.parse(args[0]) }; return { rowCount: 1, rows: [{ version: 1 }] }; }
    return { rows: [row] };
  } };
  assert.equal(await persistSnapshot(pool, payload, 0), 1);
  await projectGarden(dir, payload);
  for (const name of Object.keys(payload.files)) assert.doesNotMatch(await readFile(join(dir, name), "utf8"), /PRIVATE_SOURCE_SENTINEL|private@example/);
  const publicState = JSON.parse(await readFile(join(dir, "gerard-state.json"), "utf8"));
  assert.equal(publicState.history[0].result, "ok");
  assert.equal(publicState.lastResult.payload.output.isMock, true);
  assert.equal(adaptGerard(publicState, [{ id: "poulpe-fiction", label: "Poulpe Fiction" }]).events.length, 1, "public metadata remains readable by the real garden adapter");
  await hydrateGarden(dir, row.payload);
  assert.deepEqual(await captureGarden(dir), payload);
});

test("conflicting or unverified backups fail closed", async () => {
  const payload = { schema: "gerard-private-runtime-v1", files: { "state.json": { status: "ok" } } };
  await assert.rejects(persistSnapshot({ query: async () => ({ rowCount: 0 }) }, payload, 2), /concurrent-write/);
  const pool = { query: async sql => sql.startsWith("INSERT") ? { rowCount: 1, rows: [{ version: 3 }] } : { rows: [{ version: 3, payload: {} }] } };
  await assert.rejects(persistSnapshot(pool, payload, 2), /backup-not-verified/);
});

test("restore rejects traversal, empty snapshots and public projections", async () => {
  for (const files of [{ "../outside.json": {} }, {}, { "state.json": { publicProjection: true } }]) {
    await assert.rejects(hydrateGarden("/tmp/never-written", { schema: "gerard-private-runtime-v1", files }), /private-state-invalid/);
  }
});
