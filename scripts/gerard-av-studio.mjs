import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const exec = promisify(execFile);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function studioImagePrompt(config) {
  return [
    config.subject,
    config.style ? "Style: " + config.style : "",
    "Aspect ratio: " + (config.aspectRatio ?? "9:16"),
    "No readable text or logos unless explicitly provided.",
  ]
    .filter(Boolean)
    .join(". ");
}
export function verifyStudioProbe(p, kind, expectedDuration) {
  const streams = Array.isArray(p?.streams) ? p.streams : [];
  const v = streams.find((s) => s.codec_type === "video"),
    a = streams.find((s) => s.codec_type === "audio");
  if (kind === "image") {
    if (!v || v.codec_name !== "png" || v.width !== 1080 || v.height !== 1920)
      throw new Error("studio-local-image-invalid");
    return;
  }
  const duration = Number(p?.format?.duration);
  if (
    !Number.isFinite(expectedDuration) ||
    !Number.isFinite(duration) ||
    Math.abs(duration - expectedDuration) > 0.1 ||
    !a ||
    Number(a.sample_rate) !== 48000 ||
    a.channels !== 2
  )
    throw new Error("studio-local-" + kind + "-invalid");
  if (
    kind === "video" &&
    (!v ||
      v.width !== 1080 ||
      v.height !== 1920 ||
      v.codec_name !== "h264" ||
      v.pix_fmt !== "yuv420p" ||
      v.r_frame_rate !== "30/1" ||
      a.codec_name !== "aac")
  )
    throw new Error("studio-local-video-invalid");
  if (kind === "audio" && a.codec_name !== "pcm_s16le")
    throw new Error("studio-local-audio-invalid");
}
export const studioOperationId = (seed, kind, creativeFeedback = []) =>
  "studio-" +
  sha(
    JSON.stringify({
      parcelId: seed.parcelId,
      seedId: seed.seedId,
      title: seed.title,
      objective: seed.objective,
      templates: seed.templates,
      kind,
      creativeFeedback,
    }),
  );
/**
 * Return only the owner's reviewed creative notes for this exact parcel and
 * medium. This is contextual guidance, never authorization to publish.
 */
export function studioFeedbackForParcel(learning, parcelId, kind = "video") {
  if (kind !== "video") return [];
  const records = learning?.guidance?.ownerCreativeFeedback;
  if (!Array.isArray(records)) return [];
  return records
    .filter(
      (item) =>
        item?.parcelId === parcelId &&
        item?.assetType === "short-video" &&
        typeof item.feedbackId === "string" &&
        Array.isArray(item.creativeGuidance),
    )
    .slice(-8)
    .map((item) => ({
      feedbackId: item.feedbackId.slice(0, 120),
      creativeGuidance: item.creativeGuidance
        .filter((s) => typeof s === "string" && s.trim())
        .slice(0, 8)
        .map((s) => s.slice(0, 240)),
      prohibitedActions: (Array.isArray(item.prohibitedActions)
        ? item.prohibitedActions
        : []
      )
        .filter((s) => typeof s === "string" && s.trim())
        .slice(0, 8)
        .map((s) => s.slice(0, 180)),
    }))
    .filter((item) => item.creativeGuidance.length > 0);
}

export async function studioMission(
  seed,
  kind = "video",
  operationId,
  creativeFeedback = [],
) {
  if (!["image", "audio", "video"].includes(kind))
    throw new Error("unknown-studio-kind");
  const declaration = seed.templates?.find(
    (t) => t.id === `${kind}-studio` && t.enabled !== false,
  );
  if (!declaration) return null;
  const template = JSON.parse(
    await readFile(
      new URL(`../templates/${kind}-studio.v1.json`, import.meta.url),
      "utf8",
    ),
  );
  const configurations = Object.fromEntries(
    (seed.templates ?? [])
      .filter((t) => t.enabled !== false)
      .map((t) => [t.id, t.config ?? {}]),
  );
  const v = {
    ...configurations["image-studio"],
    ...configurations["audio-studio"],
    ...declaration.config,
  };
  // Do not silently replace a creative choice with the available local engine.
  if (
    kind !== "image" &&
    v.voiceProvider !== undefined &&
    v.voiceProvider !== "piper"
  )
    throw new Error("studio-voice-provider-unavailable");
  if (
    kind !== "image" &&
    v.musicSource !== undefined &&
    v.musicSource !== "original-procedural-CC0"
  )
    throw new Error("studio-music-source-unavailable");
  if (kind !== "image" && Object.hasOwn(v, "musicGainDb"))
    throw new Error("studio-mix-settings-unavailable");
  if (
    (v.width !== undefined && v.width !== 1080) ||
    (v.height !== undefined && v.height !== 1920) ||
    (v.fps !== undefined && v.fps !== 30) ||
    (v.format !== undefined && v.format !== "mp4") ||
    (v.aspectRatio !== undefined && v.aspectRatio !== "9:16")
  )
    throw new Error("studio-format-unavailable");
  const useVideoSource =
    kind === "video" &&
    typeof declaration.config?.videoAssetId === "string" &&
    declaration.config.videoAssetId.trim().length > 0;
  const capability = `${kind}.studio`;
  const resources = [capability];
  // These flags are explicit decisions, not inferred from a connected provider.
  if (v.allowMistralText === true) resources.push("mistral.text");
  if (!useVideoSource && v.allowMistralImage === true)
    resources.push("mistral.image");
  if (
    ![seed.seedId, seed.parcelId, operationId].every(
      (v) =>
        typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$/.test(v),
    )
  )
    throw new Error("studio-identity-required");
  return {
    operationId,
    title: v.title || seed.title,
    objective: seed.objective || `Produire un ${kind} pour cette parcelle`,
    requiredCapabilities: [capability],
    authorizedResources: resources,
    context: {
      id: seed.parcelId,
      metadata: {
        seedId: seed.seedId,
        studioRequest: {
          version: "studio-v1",
          operationId,
          parcelId: seed.parcelId,
          seedId: seed.seedId,
          title: v.title || seed.title,
          durationSeconds:
            v.durationSeconds ?? template.defaults.durationSeconds ?? 20,
          ...(useVideoSource
            ? { videoAssetId: declaration.config.videoAssetId }
            : v.assetId
              ? { assetId: v.assetId }
              : {}),
          ...(!useVideoSource && v.subject
            ? { imagePrompt: studioImagePrompt(v) }
            : {}),
          ...(v.segments
            ? { segments: v.segments, scriptRights: v.scriptRights }
            : {}),
          ...(v.knowledge ? { knowledge: v.knowledge } : {}),
          authorizedResources: resources,
          ...(creativeFeedback.length ? { creativeFeedback } : {}),
          automaticPublication: false,
        },
      },
    },
  };
}
export async function submitStudioMission(
  mission,
  octopusUrl = process.env.OCTOPUS_URL || "http://127.0.0.1:3000",
) {
  const response = await fetch(octopusUrl.replace(/\/$/, "") + "/mission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mission),
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error("studio-mission-http-" + response.status);
  return response.json();
}
export async function runParcelStudio(
  seed,
  {
    kind = "video",
    operationId,
    outputDir,
    submit = submitStudioMission,
    publisherUrl = process.env.LOCAL_PUBLISHER_URL || "http://127.0.0.1:3100",
    download,
    verifyFile,
    creativeFeedback = [],
  } = {},
) {
  const mission = await studioMission(
    seed,
    kind,
    operationId,
    creativeFeedback,
  );
  if (!mission) return { status: "disabled" };
  if (!outputDir) throw new Error("studio-archive-required");
  const dir =
    outputDir instanceof URL
      ? fileURLToPath(outputDir)
      : path.resolve(outputDir);
  let cached = false,
    result;
  try {
    const stored = JSON.parse(
      await readFile(path.join(dir, "mission.json"), "utf8"),
    );
    if (sha(JSON.stringify(stored)) === sha(JSON.stringify(mission))) {
      result = {
        status: "completed",
        output: JSON.parse(
          await readFile(path.join(dir, "report.json"), "utf8"),
        ),
      };
      cached = true;
    }
  } catch {
    /* No validated local archive yet. */
  }
  result ??= await submit(mission);
  const r = result?.output;
  if (result?.status !== "completed" || r?.status !== "ready-for-review")
    return {
      status: "blocked",
      reason: r?.code || "studio-production-not-confirmed",
      report: r ?? null,
    };
  if (
    r.parcelId !== seed.parcelId ||
    r.seedId !== seed.seedId ||
    r.operationId !== operationId ||
    r.published !== false ||
    !r.artifact?.sha256
  )
    throw new Error("studio-result-identity-mismatch");
  const filename = {
    video: "short.mp4",
    audio: "audio.wav",
    image: "image.png",
  }[kind];
  if (
    r.artifact.filename !== filename ||
    !/^[a-f0-9]{64}$/.test(r.id) ||
    r.artifact.downloadUrl !==
      `/api/production/studio/artifacts/${r.id}/${filename}`
  )
    throw new Error("invalid-studio-artifact-path");
  const main =
    Array.isArray(r.files) && r.files.find((f) => f.filename === filename);
  if (
    !main ||
    !/^[a-f0-9]{64}$/.test(main.sha256) ||
    !Number.isSafeInteger(main.bytes) ||
    main.bytes <= 0 ||
    r.artifact.sha256 !== main.sha256 ||
    r.artifact.bytes !== main.bytes
  )
    throw new Error("studio-artifact-descriptor-mismatch");
  await mkdir(dir, { recursive: true });
  async function get(route) {
    if (cached) return readFile(path.join(dir, path.basename(route)));
    if (download) return Buffer.from(await download(route));
    const response = await fetch(publisherUrl.replace(/\/$/, "") + route, {
      signal: AbortSignal.timeout(90000),
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error("studio-download-failed");
    const parts = [];
    let size = 0;
    for await (const p of response.body) {
      size += p.length;
      if (size > 100 * 1024 * 1024)
        throw new Error("studio-artifact-too-large");
      parts.push(p);
    }
    return Buffer.concat(parts);
  }
  const archive = [];
  // Keep the report, master audio, caption timing and provenance alongside MP4.
  const wanted =
    kind === "video"
      ? [
          "short.mp4",
          "audio.wav",
          "voice.wav",
          "music.wav",
          "effects.wav",
          "image.png",
          "script.json",
          "captions.srt",
          "poster.jpg",
        ]
      : kind === "audio"
        ? ["audio.wav", "voice.wav", "music.wav", "effects.wav", "script.json"]
        : ["image.png"];
  const base = r.artifact.downloadUrl.slice(
    0,
    r.artifact.downloadUrl.lastIndexOf("/") + 1,
  );
  for (const name of wanted) {
    const item = r.files?.find((x) => x.filename === name);
    if (!item) throw new Error("studio-archive-file-missing");
    const bytes = await get(base + name);
    if (sha(bytes) !== item.sha256 || bytes.length !== item.bytes)
      throw new Error("studio-artifact-hash-mismatch");
    await writeFile(path.join(dir, name), bytes);
    archive.push(item);
  }
  if (verifyFile) await verifyFile(path.join(dir, filename), kind);
  else {
    const p = JSON.parse(
      (
        await exec("ffprobe", [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          path.join(dir, filename),
        ])
      ).stdout,
    );
    verifyStudioProbe(
      p,
      kind,
      mission.context.metadata.studioRequest.durationSeconds,
    );
  }
  await writeFile(
    path.join(dir, "report.json"),
    JSON.stringify(r, null, 2) + "\n",
  );
  await writeFile(
    path.join(dir, "mission.json"),
    JSON.stringify(mission, null, 2) + "\n",
  );
  return {
    status: "ready-for-review",
    parcelId: seed.parcelId,
    seedId: seed.seedId,
    operationId,
    filename,
    archive,
    report: r,
    published: false,
    reused: cached,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const seed = JSON.parse(await readFile(process.argv[2], "utf8"));
  const result = await runParcelStudio(seed, {
    kind: process.argv[3] || "video",
    operationId: process.argv[4],
    outputDir: process.argv[5],
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "ready-for-review") process.exitCode = 1;
}
