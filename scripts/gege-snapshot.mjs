/** Local read-only collector. Never calls a production service or runs a cycle. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { adaptGerard, parseSnapshot } from "../src/garden-gege/core.mjs";
const root = new URL("../", import.meta.url);
const state = JSON.parse(
  await readFile(new URL("garden/gerard-state.json", root), "utf8"),
);
const seeds = JSON.parse(
  await readFile(new URL("garden/restart-seeds.json", root), "utf8"),
);
const labels = {
  "poulpe-fiction": "Poulpe Fiction",
  "project-yael-prospection": "Yaébali",
  "benoit-business-growth": "Parcelle professionnelle",
};
const ids = [...new Set(seeds.seeds.map((s) => s.parcelId))];
const projects = ids.map((id) => ({
  id,
  label: labels[id] ?? "Parcelle configurée",
}));
const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const snapshot = parseSnapshot({
  schemaVersion: 1,
  mode: "real",
  transport: "snapshot",
  coverage: "partial",
  generatedAt: new Date().toISOString(),
  sourceRef,
  projects,
  ...adaptGerard(state, projects),
});
const dir = new URL("prototypes/gege/public/", root);
await mkdir(dir, { recursive: true });
await writeFile(
  new URL("snapshot.json", dir),
  JSON.stringify(snapshot, null, 2) + "\n",
);
console.log(
  `Instantané local : ${snapshot.events.length} événements, ${snapshot.rejectedCount} entrées exclues. Aucun appel réseau.`,
);
