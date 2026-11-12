/**
 * Capture a REAL 420 Dice gameplay sequence without modifying the game.
 * This is a review-only source clip, not a social publication or a generated win.
 *
 * Runtime: Node 20+, Playwright/Chromium, ffmpeg and ffprobe.
 * Example: node scripts/gerard-gameplay-capture.mjs ./output/gameplay
 */
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";

const exec = promisify(execFile);
export const GAME_URL = "https://benoitlub.github.io/420-dice-game-reboot/";
const PROHIBITED_URL = "https://benoitlub.github.io/prohibited-online/";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeText = (value) => String(value).slice(0, 300);
export function validateObservation(obs) {
  if (obs?.origin !== GAME_URL || !Array.isArray(obs.rolls) || obs.rolls.length < 1 || obs.rolls.length > 3) throw new Error("GAMEPLAY_EVIDENCE_MISSING");
  const before = obs.before;
  if (!Array.isArray(before) || before.length !== 3) throw new Error("GAMEPLAY_DICE_MISSING");
  const changed = obs.rolls.some((r) => Array.isArray(r.faces) && r.faces.length === 3 && r.faces.some((face,i) => face !== before[i]));
  if (!changed) throw new Error("GAMEPLAY_DICE_UNCHANGED");
  if (!obs.rolls.every((r) => r.buttonClicked === true && r.animationObserved === true)) throw new Error("GAMEPLAY_INTERACTION_UNVERIFIED");
  return { verifiedInteractions: obs.rolls.length, facesChanged: true, status: "observed-gameplay" };
}
export function qualityDecision({ video, observations, distinctFrames }) {
  const evidence = validateObservation(observations);
  if (video.width !== 1080 || video.height !== 1920 || video.codec_name !== "h264") throw new Error("GAMEPLAY_VIDEO_FORMAT_INVALID");
  if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > 35) throw new Error("GAMEPLAY_VIDEO_DURATION_INVALID");
  if (distinctFrames < 3) throw new Error("GAMEPLAY_VISUAL_MOTION_UNVERIFIED");
  return { ...evidence, actualVideoMotion: true, technicalQuality: "passed", creativeQuality: "human-review-required", published: false };
}
async function playProhibited(page) {
  await page.locator("button.solo-ai-native-button").click({ timeout: 30000 });
  const endTurn = page.getByRole("button", { name: "Finir le tour", exact: true });
  const log = page.locator(".event-log");
  const before = await log.innerText({ timeout: 10000 });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Jouer / }).and(page.locator(":enabled")).first().click({ timeout: 5000 });
  const afterCard = await log.innerText();
  if (afterCard === before) throw new Error("PROHIBITED_CARD_PLAY_UNVERIFIED");
  await page.waitForTimeout(1000);
  await endTurn.click();
  await page.locator(".ai-hidden-hand").waitFor({ state: "visible", timeout: 5000 });
  await endTurn.waitFor({ state: "visible", timeout: 10000 });
  const afterBot = await log.innerText();
  if (afterBot === afterCard) throw new Error("PROHIBITED_BOT_TURN_UNVERIFIED");
  await page.waitForTimeout(1200);
  return { origin: PROHIBITED_URL, before, afterCard, afterBot, observedAt: new Date().toISOString() };
}
async function playDice(page) {
  await page.getByTestId("dice-board").waitFor({ timeout: 30000 });
  const faces = async () => page.locator('[data-testid^="die-"]').evaluateAll(
    (nodes) => nodes.map((el) => el.getAttribute("aria-label") || "")
  );
  const before = await faces();
  if (before.length !== 3) throw new Error("THREE_DICE_NOT_VISIBLE");
  await page.waitForTimeout(900);
  const rolls = [];
  for (let i = 0; i < 3; i++) {
    const rollButton = page.getByTestId("button-roll");
    if (!(await rollButton.count()) || !(await rollButton.isEnabled())) break;
    const prior = await faces();
    await rollButton.click();
    const rolling = await page.locator('[data-testid^="die-"].animate-dice-roll').count();
    await page.waitForTimeout(1100);
    const after = await faces();
    rolls.push({ attempt: i + 1, buttonClicked: true, animationObserved: rolling > 0, prior, faces: after.map(safeText) });
    await page.waitForTimeout(900);
  }
  const observation = { version: "gameplay-capture-v1", origin: GAME_URL, before: before.map(safeText), rolls, observedAt: new Date().toISOString(), rights: "Screenshot of the creator's own published game; review only" };
  validateObservation(observation);
  return observation;
}
async function launch() {
  const isProhibited = process.argv[3] === "prohibited-online";
  const gameUrl = new URL(isProhibited ? PROHIBITED_URL : GAME_URL);
  const outputDir = path.resolve(process.argv[2] || "./output/gerard-420-gameplay");
  const playwrightModule = await import(process.env.GERARD_PLAYWRIGHT_MODULE || "playwright");
  const browser = await playwrightModule.chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: isProhibited ? { width: 432, height: 768 } : { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: outputDir, size: { width: 540, height: 960 } }
  });
  let page;
  try {
    await mkdir(outputDir, { recursive: true });
    if (!isProhibited) await context.addInitScript(() => {
      window.localStorage.setItem("bl_onboarding_done_v1", "true");
      window.localStorage.setItem("bl_locale_v1", "fr");
      window.localStorage.setItem("bl_sound_enabled", "false");
    });
    page = await context.newPage();
    await page.route("**/*", (route) => {
      const req = route.request();
      const url = new URL(req.url());
      // Playback must never send state-changing HTTP requests to other services.
      if (!["GET","HEAD"].includes(req.method())) return route.abort();
      if (url.origin !== gameUrl.origin || !url.pathname.startsWith(gameUrl.pathname)) return route.abort();
      return route.continue();
    });
    const response = await page.goto(gameUrl.href, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (isProhibited && !response?.ok()) throw new Error(`PROHIBITED_PAGE_HTTP_${response?.status() ?? "UNKNOWN"}`);
    const observation = isProhibited ? await playProhibited(page) : await playDice(page);
    await page.screenshot({ path: path.join(outputDir, "final-frame.png") });
    const recorded = await page.video();
    await context.close();
    await copyFile(await recorded.path(), path.join(outputDir, "gameplay-source.webm"));
    await exec("ffmpeg", ["-v","error","-nostdin","-y","-i", "gameplay-source.webm", "-vf","scale=1080:1920:flags=lanczos,setsar=1,fps=30,format=yuv420p", "-an","-c:v","libx264","-preset","fast","-crf","21","-movflags","+faststart", "gameplay-vertical.mp4"], { cwd: outputDir, timeout: 180000 });
    const info = JSON.parse((await exec("ffprobe",["-v","error","-show_streams","-show_format","-of","json","gameplay-vertical.mp4"], { cwd: outputDir })).stdout);
    const v = info.streams.find((s) => s.codec_type === "video");
    const hashes = (await exec("ffmpeg",["-v","error","-i","gameplay-vertical.mp4","-vf",isProhibited ? "fps=2,scale=180:320" : "fps=1/2,crop=720:500:180:500,scale=180:125","-f","framemd5","-"],{ cwd: outputDir })).stdout.split("\n").filter((s) => s && !s.startsWith("#")).map((s) => s.split(",").at(-1).trim());
    const distinctFrames = new Set(hashes).size;
    const video = { width: v.width, height: v.height, codec_name: v.codec_name, duration: Number(info.format.duration) };
    if (isProhibited && (video.width !== 1080 || video.height !== 1920 || video.codec_name !== "h264" || video.duration < 3 || distinctFrames < 3)) {
      throw new Error("PROHIBITED_CAPTURE_QUALITY_UNVERIFIED");
    }
    const decision = isProhibited
      ? { verifiedInteractions: 2, actualVideoMotion: true, technicalQuality: "passed", published: false }
      : qualityDecision({ video, observations: observation, distinctFrames });
    const files = {};
    for (const name of ["gameplay-source.webm","gameplay-vertical.mp4","final-frame.png"]) {
      const bytes = await readFile(path.join(outputDir,name));
      files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
    }
    await writeFile(path.join(outputDir, "review-report.json"), JSON.stringify({ ...decision, observation, video: { width: v.width, height: v.height, fps: v.r_frame_rate, durationSeconds: Number(info.format.duration), silent: true }, distinctSampledGameplayFrames: distinctFrames, files, nextStep: "Send this verified source clip to Publisher's montage pipeline; no automatic publishing or email." },null,2)+"\n");
    process.stdout.write(JSON.stringify({ status:"ready-for-review", outputDir, distinctFrames, verifiedInteractions:decision.verifiedInteractions })+"\n");
  } catch (error) {
    if (isProhibited && page) {
      await page.screenshot({ path: path.join(outputDir, "final-frame.png") }).catch(() => {});
      const visibleText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      process.stderr.write(JSON.stringify({ title: await page.title().catch(() => ""), visibleText: safeText(visibleText) }) + "\n");
    }
    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  launch().catch((error) => { console.error(error); process.exitCode = 1; });
}
