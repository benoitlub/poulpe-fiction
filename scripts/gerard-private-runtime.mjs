/** Private runtime snapshots live in the existing PostgreSQL database. */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { summarizeCycleResult } from "./gerard-state-summary.mjs";

const schema = "gerard-private-runtime-v1";
const safeName = name => /^[a-z0-9][a-z0-9-]*\.json$/.test(name);
// Reviewed source configuration remains versioned and is never restored over edits.
const sourceConfiguration = new Set(["restart-seeds.json", "publication-experiment-30d.json", "gerard-owner-feedback.json", "verified-external-publications.json"]);
const metadataKeys = new Set(["id", "seedId", "parcelId", "harvestId", "operationId", "at", "harvestedAt", "updatedAt", "preparedAt", "lastRunAt", "lastMode", "lastSeedId", "mode", "result", "outcome", "decision", "provenance", "status", "state", "capability", "route", "count", "completed", "simulated", "isMock", "mock"]);
function metadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([k, v]) => metadataKeys.has(k) &&
    (typeof v === "boolean" || typeof v === "number" || typeof v === "string" && /^[\w.:>/-]{1,160}$/.test(v) && !v.includes("://"))));
}
export function publicProjection(name, value) {
  const base = { publicProjection: true, status: "private", storage: "postgresql", schema };
  if (name === "gerard-state.json") return { ...base, ...metadata(value),
    history: (Array.isArray(value.history) ? value.history : []).map(metadata),
    learningHistory: (Array.isArray(value.learningHistory) ? value.learningHistory : []).map(metadata),
    lastResult: summarizeCycleResult(value.lastResult) };
  if (name === "restart-seeds.json") return { ...base, seeds: (value.seeds ?? []).map(metadata) };
  if (name === "harvests.json") return { ...base, harvests: (value.harvests ?? []).map(h => ({ ...metadata(h), privateContent: true })) };
  return { ...base, updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : undefined };
}
export async function captureGarden(dir) {
  const files = {};
  for (const name of (await readdir(dir)).filter(name => safeName(name) && !sourceConfiguration.has(name)).sort()) files[name] = JSON.parse(await readFile(join(dir, name), "utf8"));
  if (!Object.keys(files).length) throw new Error("private-state-empty");
  return { schema, files };
}
export async function hydrateGarden(dir, payload) {
  if (payload?.schema !== schema || !payload.files || typeof payload.files !== "object" || Array.isArray(payload.files)) throw new Error("private-state-invalid");
  const entries = Object.entries(payload.files);
  if (!entries.length || entries.some(([name, value]) => !safeName(name) || !value || typeof value !== "object" || value.publicProjection === true)) throw new Error("private-state-invalid");
  await mkdir(dir, { recursive: true });
  for (const [name, value] of entries) await writeFile(join(dir, name), JSON.stringify(value, null, 2) + "\n");
}
export async function ensureStore(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS gerard_private_runtime (
    snapshot_key text PRIMARY KEY, version integer NOT NULL, payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now())`);
}
export async function persistSnapshot(pool, payload, expectedVersion) {
  if (JSON.stringify(payload).length > 10_000_000) throw new Error("private-state-too-large");
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("private-state-version-invalid");
  const saved = await pool.query(`INSERT INTO gerard_private_runtime (snapshot_key, version, payload)
    SELECT 'poulpe-fiction', 1, $1::jsonb WHERE $2 = 0 OR EXISTS
      (SELECT 1 FROM gerard_private_runtime WHERE snapshot_key = 'poulpe-fiction' AND version = $2)
    ON CONFLICT (snapshot_key) DO UPDATE SET version = gerard_private_runtime.version + 1,
      payload = EXCLUDED.payload, updated_at = now()
    WHERE gerard_private_runtime.version = $2 RETURNING version`, [JSON.stringify(payload), expectedVersion]);
  if (saved.rowCount !== 1) throw new Error("private-state-concurrent-write");
  const check = await pool.query("SELECT version, payload FROM gerard_private_runtime WHERE snapshot_key = 'poulpe-fiction'");
  if (check.rows[0]?.version !== saved.rows[0].version || !isDeepStrictEqual(check.rows[0]?.payload, payload)) throw new Error("private-state-backup-not-verified");
  return saved.rows[0].version;
}
// Each tentacle sends only its local changes. The short row lock serializes
// commits, while the tentacles run independently against their hydrated view.
function mergeOutbox(base, local, latest) {
  const before = new Map((base?.drafts ?? []).map(draft => [draft.id, draft]));
  const merged = new Map((latest?.drafts ?? []).map(draft => [draft.id, draft]));
  for (const draft of local.drafts ?? []) {
    const prior = before.get(draft.id);
    if (isDeepStrictEqual(draft, prior)) continue;
    const current = merged.get(draft.id);
    if (!current || isDeepStrictEqual(current, prior)) {
      merged.set(draft.id, draft);
      continue;
    }
    // A contact outcome must survive a simultaneous refresh of its draft.
    const attempted = value => value?.sentAt || value?.contacted ||
      ["sent", "sending", "unknown", "duplicate-blocked"].includes(value?.status);
    if (attempted(draft) && !attempted(current)) merged.set(draft.id, { ...current, ...draft });
  }
  return { ...local, ...latest, drafts: [...merged.values()].slice(-100) };
}

async function persistTentacle(pool, baseline, local) {
  const changed = Object.entries(local.files).filter(([name, value]) =>
    !isDeepStrictEqual(baseline.files[name], value));
  if (!changed.length) return { files: {}, version: null };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO gerard_private_runtime (snapshot_key, version, payload) VALUES ('poulpe-fiction', 1, $1::jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(baseline)],
    );
    const locked = await client.query("SELECT version, payload FROM gerard_private_runtime WHERE snapshot_key = 'poulpe-fiction' FOR UPDATE");
    const latest = locked.rows[0].payload;
    const files = { ...latest.files };
    const applied = {};
    for (const [name, value] of changed) {
      const before = baseline.files[name];
      const current = latest.files[name];
      if (name === "gerard-mail-outbox.json") applied[name] = mergeOutbox(before, value, current);
      else if (isDeepStrictEqual(current, before) || isDeepStrictEqual(current, value)) applied[name] = value;
      else throw new Error("tentacle-state-conflict:" + name);
      files[name] = applied[name];
    }
    const payload = JSON.stringify({ schema, files });
    if (payload.length > 10_000_000) throw new Error("private-state-too-large");
    const result = await client.query("UPDATE gerard_private_runtime SET version = version + 1, payload = $1::jsonb, updated_at = now() WHERE snapshot_key = 'poulpe-fiction' RETURNING version, payload", [payload]);
    if (!isDeepStrictEqual(result.rows[0]?.payload, JSON.parse(payload))) throw new Error("private-state-backup-not-verified");
    await client.query("COMMIT");
    return { files: applied, version: result.rows[0].version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function projectGarden(dir, payload) {
  for (const [name, value] of Object.entries(payload.files)) {
    if (!safeName(name)) throw new Error("private-state-invalid-name");
    await writeFile(join(dir, name), JSON.stringify(publicProjection(name, value), null, 2) + "\n");
  }
}
async function main() {
  if (!process.env.DATABASE_URL || !process.env.GERARD_PUBLISHER_DB_PACKAGE) throw new Error("private-state-database-not-configured");
  const require = createRequire(resolve(process.env.GERARD_PUBLISHER_DB_PACKAGE));
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dir = resolve(process.env.GERARD_PRIVATE_GARDEN_PATH || "garden");
  const marker = process.env.GERARD_PRIVATE_VERSION_PATH || "/tmp/gerard-private-runtime-version";
  try {
    await ensureStore(pool);
    if (process.argv[2] === "hydrate") {
      const current = await pool.query("SELECT version, payload FROM gerard_private_runtime WHERE snapshot_key = 'poulpe-fiction'");
      const row = current.rows[0];
      if (row) await hydrateGarden(dir, row.payload);
      else {
        const initial = await captureGarden(dir);
        if (Object.values(initial.files).some(v => v.publicProjection === true)) throw new Error("private-state-backup-required");
      }
      await writeFile(marker, String(row?.version ?? 0));
      if (process.env.GERARD_TENTACLE) {
        await writeFile(marker + ".baseline", JSON.stringify(await captureGarden(dir)), { mode: 0o600 });
      }
      console.log(JSON.stringify({ status: row ? "private-state-restored" : "private-state-bootstrap", version: row?.version ?? 0 }));
    } else if (process.argv[2] === "persist") {
      const expected = Number(await readFile(marker, "utf8"));
      const payload = await captureGarden(dir);
      if (Object.values(payload.files).some(v => v.publicProjection === true)) throw new Error("private-state-not-hydrated");
      if (process.env.GERARD_TENTACLE) {
        const baseline = JSON.parse(await readFile(marker + ".baseline", "utf8"));
        const saved = await persistTentacle(pool, baseline, payload);
        await projectGarden(dir, { files: { ...payload.files, ...saved.files } });
        console.log(JSON.stringify({ status: "tentacle-state-saved", lane: process.env.GERARD_TENTACLE,
          version: saved.version, changedFiles: Object.keys(saved.files) }));
        return;
      }
      const version = await persistSnapshot(pool, payload, expected);
      // No public file is changed before the durable backup is read back.
      await projectGarden(dir, payload);
      console.log(JSON.stringify({ status: "private-state-saved-and-projected", version, fileCount: Object.keys(payload.files).length }));
    } else throw new Error("private-state-mode-invalid");
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const conflict = /^tentacle-state-conflict:[a-z0-9-]+\.json$/.test(error?.message ?? "") ? error.message : null;
    console.error(conflict ?? "Private runtime persistence failed; refusing public state commit. See the private database configuration.");
    process.exitCode = 1;
  });
}
