import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

function currentSha() {
  const explicit = process.env.POULPE_BUILD_SHA || process.env.RENDER_GIT_COMMIT;
  if (explicit) return String(explicit).slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch (_) {
    return "local";
  }
}

await writeFile("build-info.js", `globalThis.POULPE_BUILD_SHA = ${JSON.stringify(currentSha())};\n`, "utf8");
