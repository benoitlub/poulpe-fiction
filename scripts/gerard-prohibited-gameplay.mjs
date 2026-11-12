import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const prohibitedGameplaySeedId = "prohibited-online-gameplay-preview";
const assetId = "prohibited-online-captured-gameplay";
const source = "https://benoitlub.github.io/prohibited-online/";
const exec = promisify(execFile);

export async function prepareProhibitedGameplay(assetsDir = process.env.GERARD_STUDIO_ASSETS_DIR) {
  if (!assetsDir || !process.env.GERARD_PLAYWRIGHT_MODULE) throw new Error("studio-gameplay-runtime-missing");
  const dir = await mkdtemp(path.join(tmpdir(), "gerard-prohibited-"));
  try {
    const script = fileURLToPath(new URL("./gerard-gameplay-capture.mjs", import.meta.url));
    await exec(process.execPath, [script, dir, "prohibited-online"], { timeout: 210000 });
    const filename = "gameplay-vertical.mp4";
    const video = await readFile(path.join(dir, filename));
    const report = JSON.parse(await readFile(path.join(dir, "review-report.json"), "utf8"));
    const sha256 = createHash("sha256").update(video).digest("hex");
    if (report.technicalQuality !== "passed" || report.observation?.origin !== source ||
        report.files?.[filename]?.sha256 !== sha256) {
      throw new Error("studio-gameplay-evidence-invalid");
    }
    const file = assetId + "-" + sha256 + ".mp4";
    const catalogPath = path.join(assetsDir, "assets.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    if (catalog.version !== "studio-assets-v1" || !Array.isArray(catalog.assets)) throw new Error("studio-catalog-invalid");
    catalog.assets = catalog.assets.filter(asset => asset.id !== assetId);
    catalog.assets.push({ id: assetId, parcelId: "prohibited-online", file, sha256, rights: {
      license: "LicenseRef-Owner-Authorized-Preview", scope: "local-preview",
      source, attribution: "Partie enregistrée dans le jeu de Benoît Lubert",
    } });
    await writeFile(path.join(assetsDir, file), video);
    await writeFile(catalogPath + ".gerard-pending", JSON.stringify(catalog, null, 2) + "\n");
    await rename(catalogPath + ".gerard-pending", catalogPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
