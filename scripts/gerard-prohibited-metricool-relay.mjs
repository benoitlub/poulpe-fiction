import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { handoffMetricoolByEmail } from "./gerard-metricool-publication.mjs";

const repo = "benoitlub/poulpe-fiction";
const tag = "gerard-prohibited-online-studio-v1";
const filename = "prohibited-online-studio-v1.mp4";
const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${filename}`;
const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
const maxBytes = 12 * 1024 * 1024;

export async function relayProhibitedStudio({ fetchImpl = fetch, handoff = handoffMetricoolByEmail } = {}) {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  const response = await fetchImpl(releaseUrl, { headers, signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return { status: "awaiting-studio-export" };
  if (!response.ok) throw new Error("studio-release-http-" + response.status);
  const release = await response.json();
  const asset = release.assets?.find(item => item.name === filename && item.state === "uploaded");
  if (!asset) return { status: "awaiting-studio-export" };
  if (release.draft !== false || release.tag_name !== tag || asset.browser_download_url !== downloadUrl ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? "") ||
      !Number.isSafeInteger(asset.size) || asset.size < 12 || asset.size > maxBytes) {
    throw new Error("studio-release-asset-invalid");
  }

  const video = await fetchImpl(downloadUrl, { signal: AbortSignal.timeout(30000) });
  if (!video.ok || !video.body) throw new Error("studio-video-download-http-" + video.status);
  let size = 0;
  let prefix = Buffer.alloc(0);
  const hash = createHash("sha256");
  for await (const bytes of video.body) {
    size += bytes.length;
    if (size > asset.size) throw new Error("studio-video-download-size-mismatch");
    if (prefix.length < 12) prefix = Buffer.concat([prefix, bytes.subarray(0, 12 - prefix.length)]);
    hash.update(bytes);
  }
  if (size !== asset.size || prefix.toString("ascii", 4, 8) !== "ftyp" || "sha256:" + hash.digest("hex") !== asset.digest) {
    throw new Error("studio-video-download-integrity-failed");
  }

  const candidate = {
    status: "ready",
    harvestId: tag,
    seedId: "prohibited-online-gameplay-preview",
    title: "Pro.Hibited Online",
    transport: { provider: "metricool", brandId: "3350145" },
    editorialRoute: { destination: { preferredProvider: "metricool" } },
    compatibleNetworks: ["instagram"],
    copy: { text: "Une table, cinq cartes en main. Joue ou défausse, puis regarde le Feuch Bot prendre la main. Le jeu de cartes Pro.Hibited se joue aussi en ligne.\n\nhttps://benoitlub.github.io/prohibited-online/" },
    media: { url: downloadUrl },
  };
  const delivered = await handoff(candidate, { fetchImpl, presentation: "contract-v1" });
  const instagram = delivered.metricoolHandoff ?? { status: "handoff-ineligible" };
  // Reuse the same verified Studio MP4 for Blacklace TikTok, but only when
  // explicitly enabled. A distinct harvest ID keeps each network's receipt
  // and deduplication independent; never infer the TikTok account from IG.
  if (process.env.GERARD_STUDIO_TIKTOK_RELAY_ENABLED !== "true") return instagram;
  if (!["mail-sent", "mail-already-reserved"].includes(instagram.status))
    return { status: "blocked", reason: "INSTAGRAM_RELAY_UNCONFIRMED", instagram };
  const tiktokCandidate = {
    ...candidate,
    harvestId: tag + "-tiktok",
    transport: { provider: "metricool", brandId: "7653100" },
    compatibleNetworks: ["tiktok"],
  };
  const tiktokDelivered = await handoff(tiktokCandidate, { fetchImpl, presentation: "contract-v1" });
  const tiktok = tiktokDelivered.metricoolHandoff ?? { status: "handoff-ineligible" };
  return {
    status: ["mail-sent", "mail-already-reserved"].includes(tiktok.status) ? "relays-handed-off" : "blocked",
    instagram, tiktok,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const outcome = await relayProhibitedStudio();
    console.log(JSON.stringify({ prohibitedStudioMetricool: outcome }));
    if (!["awaiting-studio-export", "mail-sent", "mail-already-reserved", "relays-handed-off"].includes(outcome.status)) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ prohibitedStudioMetricool: { status: "blocked", reason: error.message } }));
    process.exitCode = 1;
  }
}
