import type { EditorialSource, HarvestBundle, MissionProgress } from "../types";

type UnknownRecord = Record<string, unknown>;
type GardenSnapshot = { harvests?: UnknownRecord[]; parcels?: UnknownRecord[] };

declare global {
  interface Window {
    GardenStore?: { snapshot(): GardenSnapshot };
  }
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");

function renderBody(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const value = line.trim();
    if (!value) return "";
    const heading = value.match(/^(#{1,3})\s+(.+)$/);
    if (heading) return `<h${heading[1].length}>${escapeHtml(heading[2])}</h${heading[1].length}>`;
    const bullet = value.match(/^[-*]\s+(.+)$/);
    if (bullet) return `<li>${escapeHtml(bullet[1])}</li>`;
    return `<p>${escapeHtml(value)}</p>`;
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

function bundleFromGardenHarvest(harvest: UnknownRecord, snapshot: GardenSnapshot): HarvestBundle | null {
  const payload = record(harvest.payload);
  const result = record(payload.result);
  const output = record(result.output);
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
  const artifact = artifacts[0] ?? record(result.artifact);
  const content = text(harvest.content) || text(harvest.latestContent) || text(harvest.originalContent) || text(artifact.content) || text(artifact.artifact) || text(output.text) || text(result.content);
  if (!content) return null;

  const missionId = text(harvest.operationId) || text(harvest.missionId) || text(harvest.id);
  if (!missionId) return null;
  const parcelId = text(harvest.parcelId) || "poulpe-fiction";
  const title = text(harvest.title) || text(artifact.title) || "Récolte de Gérard";
  const createdAt = text(harvest.createdAt) || text(harvest.completedAt) || new Date().toISOString();

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
