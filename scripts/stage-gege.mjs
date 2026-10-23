/** Include the verified, isolated preview in Pages without changing the existing home. */
import { cp, readFile, rm } from "node:fs/promises";
import { parseSnapshot } from "../src/garden-gege/core.mjs";

const source = new URL("../dist-gege/", import.meta.url);
const target = new URL("../dist/jardin-gege/", import.meta.url);
await readFile(new URL("index.html", source), "utf8");
parseSnapshot(JSON.parse(await readFile(new URL("snapshot.json", source), "utf8")), "real");
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log("Aperçu ajouté à dist/jardin-gege/ ; home existante conservée.");
