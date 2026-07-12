import { copyFile, mkdir, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const allowedExtensions = new Set([".js", ".css"]);

await mkdir(dist, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  if (!allowedExtensions.has(extname(entry.name))) continue;
  await copyFile(join(root, entry.name), join(dist, entry.name));
}

console.log("Copied classic JavaScript and CSS assets to dist.");
