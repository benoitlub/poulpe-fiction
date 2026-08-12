import type { EditorialSource, GardenSnapshot, HarvestBundle, MissionProgress, UnknownRecord } from "../types";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
const linkify = (escapedValue: string) => escapedValue.replace(/\[([^[\]]+)\]\((https?:\/\/[^\s()]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

function renderBody(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const value = line.trim();
    if (!value) return "";
    const heading = value.match(/^(#{1,3})\s+(.+)$/);
    if (heading) return `<h${heading[1].length}>${linkify(escapeHtml(heading[2]))}</h${heading[1].length}>`;
    const bullet = value.match(/^[-*]\s+(.+)$/);
    if (bullet) return `<li>${linkify(escapeHtml(bullet[1]))}</li>`;
    return `<p>${linkify(escapeHtml(value))}</p>`;
  }).join("\n").replace(/(?:<li>.*?<\/li>\s*)+/gs, (items) => `<ul>${items}</ul>`);
}

function htmlDocument(title: string, content: string) {
  const body = /<\s*(?:article|section|main|h1|p|div)[\s>]/i.test(content) ? content : renderBody(content);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{color-scheme:light dark;font-family:Inter,system-ui,sans-serif}body{margin:0;background:#0b1024;color:#f6f0dc}main{max-width:780px;margin:auto;padding:42px 22px 70px}article{background:#11182d;border:1px solid #2b3552;border-radius:24px;padding:32px}h1,h2,h3{font-family:Georgia,serif;color:#f5ddb0}p,li{font-size:1.05rem;line-height:1.7}</style></head><body><main><article><h1>${escapeHtml(title)}</h1>${body}</article></main></body></html>`;
}

function dateValue(item: UnknownRecord) {
  return Date.parse(text(item.createdAt) || text(item.completedAt) || text(item.date) || "") || 0;
}

function editorialSource(harvest: UnknownRecord, payload: UnknownRecord, result: UnknownRecord): EditorialSource | undefined {
  const harvestEditorial = record(harvest.editorialSource);
  const payloadEditorial = record(payload.editorialSource);
  const resultEditorial = record(result.editorialSource);
  const notion = record(result.notion);
  const url = text(harvest.notionUrl) || text(harvestEditorial.url) || text(payload.notionUrl) || text(payloadEditorial.url) || text(result.notionUrl) || text(resultEditorial.url) || text(notion.url);
  if (!url) return undefined;
  return {
    provider: "notion",
    url,
    pageId: text(harvest.notionPageId) || text(harvestEditorial.pageId) || text(payload.notionPageId) || text(payloadEditorial.pageId) || text(result.notionPageId) || text(resultEditorial.pageId) || text(notion.pageId) || undefined,
    databaseId: text(harvestEditorial.databaseId) || text(payloadEditorial.databaseId) || text(resultEditorial.databaseId) || text(notion.databaseId) || undefined,
    status: (text(harvestEditorial.status) || text(payloadEditorial.status) || text(resultEditorial.status) || text(notion.status) || undefined) as EditorialSource["status"],
    lastSyncedAt: text(harvest.lastSyncedAt) || text(harvestEditorial.lastSyncedAt) || text(payloadEditorial.lastSyncedAt) || text(resultEditorial.lastSyncedAt) || text(notion.lastSyncedAt) || undefined,
  };
}

function findVisualArtifact(harvest: UnknownRecord, output: UnknownRecord, result: UnknownRecord): UnknownRecord | null {
  const candidates = [
    ...(Array.isArray(output.artifacts) ? output.artifacts.map(record) : []),
    ...(Array.isArray(output.harvests) ? output.harvests.map(record) : []),
    ...(Array.isArray(result.artifacts) ? result.artifacts.map(record) : []),
    ...(Array.isArray(result.harvests) ? result.harvests.map(record) : []),
    record(harvest.visual),
  ];
  const visual = candidates.find((item) => {
    const type = `${text(item.kind)} ${text(item.type)} ${text(item.artifactType)}`.toLowerCase();
    const url = text(item.previewUrl) || text(item.url) || text(item.downloadUrl);
    return /visual|image|instagram/.test(type) && Boolean(url);
  });
  return visual && Object.keys(visual).length ? visual : null;
}

function publicationText(harvest: UnknownRecord, visual: UnknownRecord, output: UnknownRecord, result: UnknownRecord): string {
  return text(harvest.postText) || text(harvest.caption) || text(visual.postText) || text(visual.caption) || text(output.postText) || text(output.caption) || text(result.postText) || text(result.caption);
}

function bundleFromGardenHarvest(harvest: UnknownRecord, snapshot: GardenSnapshot): HarvestBundle | null {
  const payload = record(harvest.payload);
  const result = record(payload.result);
  const output = record(result.output);
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
  const artifact = artifacts[0] ?? record(result.artifact);
  const content = text(harvest.content) || text(harvest.latestContent) || text(harvest.originalContent) || text(artifact.content) || text(artifact.artifact) || text(output.text) || text(result.content);

  const missionId = text(harvest.operationId) || text(harvest.missionId) || text(harvest.id);
  if (!missionId) return null;
  const parcelId = text(harvest.parcelId) || "poulpe-fiction";
  const title = text(harvest.title) || text(artifact.title) || "Récolte de Gérard";
  const createdAt = text(harvest.createdAt) || text(harvest.completedAt) || new Date().toISOString();
  const visual = findVisualArtifact(harvest, output, result);
  const postText = visual ? publicationText(harvest, visual, output, result) : "";

  // A publication pack is only considered real when an actual visual URL exists
  // AND a publication text exists. A prompt, title or placeholder never counts.
  if (visual && postText) {
    const previewUrl = text(visual.previewUrl) || text(visual.url) || text(visual.downloadUrl);
    const downloadUrl = text(visual.downloadUrl) || text(visual.url) || undefined;
    return {
      missionId,
      createdAt,
      intent: {
        parcelId,
        goal: text(payload.title) || text(payload.objective) || title,
        audience: text(payload.audience) || undefined,
        format: text(visual.format) || text(visual.dimensions) || "Instagram",
      },
      harvest: {
        kind: "publication-pack",
        status: "ready-to-use",
        title: text(visual.title) || title,
        previewUrl,
        downloadUrl,
        caption: postText,
        format: text(visual.format) || "Instagram",
        dimensions: text(visual.dimensions) || "1080 × 1350",
        postText,
        sourceUrl: text(harvest.sourceUrl) || text(visual.sourceUrl) || undefined,
      },
      editorialSource: editorialSource(harvest, payload, result),
    };
  }

  if (!content) return null;
  return {
    missionId,
    createdAt,
    intent: {
      parcelId,
      goal: text(payload.title) || text(payload.objective) || title,
    },
    harvest: {
      kind: "landing",
      status: "ready-to-use",
      title,
      previewUrl: "",
      copy: content,
      html: htmlDocument(title, content),
    },
    editorialSource: editorialSource(harvest, payload, result),
  };
}

export function restoreAllGardenHarvests(): HarvestBundle[] {
  const snapshot = window.GardenStore?.snapshot?.() ?? {};
  const seen = new Set<string>();
  return [...(snapshot.harvests ?? [])]
    .map(record)
    .sort((a, b) => dateValue(b) - dateValue(a))
    .map((harvest) => bundleFromGardenHarvest(harvest, snapshot))
    .filter((bundle): bundle is HarvestBundle => Boolean(bundle))
    .filter((bundle) => {
      if (seen.has(bundle.missionId)) return false;
      seen.add(bundle.missionId);
      return true;
    });
}

export function restoreLatestGardenHarvest(): { bundle: HarvestBundle; progress: MissionProgress } | null {
  const snapshot = window.GardenStore?.snapshot?.() ?? {};
  const bundle = restoreAllGardenHarvests()[0];
  if (!bundle) return null;
  const parcel = (snapshot.parcels ?? []).map(record).find((item) => text(item.id) === bundle.intent.parcelId) ?? {};

  return {
    bundle,
    progress: {
      missionId: bundle.missionId,
      state: "harvest-ready",
      step: "done",
      label: "Gérard revient avec la récolte",
      description: text(parcel.name) ? `Récolte prête pour ${text(parcel.name)}.` : "La récolte est prête.",
      progress: 1,
      finished: true,
    },
  };
}
