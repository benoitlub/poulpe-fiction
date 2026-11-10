/** Stage the Lovable garden as a static GitHub Pages subroute; preserve Poulpe home. */
import { cp, readFile, rename, rm } from "node:fs/promises";

const source = new URL("../dist-gege/", import.meta.url);
const target = new URL("../dist/jardin-gege/", import.meta.url);
await readFile(new URL("static.html", source), "utf8");
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
await rename(new URL("static.html", target), new URL("index.html", target));
console.log("Jardin Lovable staged at dist/jardin-gege/; Poulpe home preserved.");
