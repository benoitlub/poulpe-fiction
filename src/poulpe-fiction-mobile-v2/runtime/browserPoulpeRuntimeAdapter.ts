import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";
import type {
  ClientAccessContext,
  CultivationIntent,
  Harvest,
  HarvestBundle,
  MissionId,
  MissionProgress,
  Parcel,
  RuntimeQuestion,
} from "../types";

type UnknownRecord = Record<string, unknown>;

type GardenSnapshot = {
  parcels?: UnknownRecord[];
  operations?: UnknownRecord[];
  harvests?: UnknownRecord[];
};

declare global {
  interface Window {
    PoulpeAccess?: { snapshot(): UnknownRecord };
    GardenStore?: { snapshot(): GardenSnapshot };
    PoulpeOctopusAdapter?: {
      dispatch(payload: UnknownRecord, options?: UnknownRecord): Promise<UnknownRecord>;
      normalizedStatus?(status: unknown): string;
    };
  }
}

const missions = new Map<MissionId, { intent: CultivationIntent; result?: UnknownRecord; error?: string }>();

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function garden(): GardenSnapshot {
  return window.GardenStore?.snapshot?.() ?? {};
}

function parcelDescription(parcel: UnknownRecord): string {
  return text(parcel.mission) || text(parcel.description) || "Parcelle confiée à Gérard";
}

function toParcel(parcel: UnknownRecord): Parcel {
  return {
    id: text(parcel.id),
    name: text(parcel.name) || text(parcel.id),
    description: parcelDescription(parcel),
    emoji: "🌱",
  };
}

function clientContext(): ClientAccessContext | null {
  const access = record(window.PoulpeAccess?.snapshot?.());
  const parcelId = text(access.parcelId);
  if (!parcelId) return null;
  const parcel = (garden().parcels ?? []).map(record).find((item) => text(item.id) === parcelId);
  const client = record(parcel?.client);
  return {
    clientId: text(access.clientId) || text(client.id) || parcelId,
    parcelId,
    displayName: text(client.displayName) || text(client.name) || text(parcel?.name) || "Votre projet",
    activity: text(client.activity) || parcelDescription(parcel ?? {}),
  };
}

function operationFor(missionId: MissionId): UnknownRecord | undefined {
  return (garden().operations ?? []).map(record).find((item) => text(item.id) === missionId || text(item.operationId) === missionId);
}

function questionFrom(value: UnknownRecord, missionId: MissionId): RuntimeQuestion | undefined {
  const candidate = record(value.question ?? value.requiredInput ?? value.inputRequest);
  const label = text(candidate.label) || text(candidate.question) || text(value.question);
  if (!label) return undefined;
  return {
    id: text(candidate.id) || text(candidate.key) || `question-${missionId}`,
    missionId,
    label,
    reason: text(candidate.reason) || undefined,
    options: Array.isArray(candidate.options) ? candidate.options.map(String) : undefined,
    inputType: (text(candidate.inputType) as RuntimeQuestion["inputType"]) || "text",
    scope: (text(candidate.scope) as RuntimeQuestion["scope"]) || "mission",
  };
}

function progressFor(missionId: MissionId): MissionProgress {
  const cached = missions.get(missionId);
  const operation = operationFor(missionId) ?? {};
  const result = record(cached?.result);
  const rawStatus = text(result.status) || text(operation.status) || (cached?.error ? "failed" : "running");
  const status = window.PoulpeOctopusAdapter?.normalizedStatus?.(rawStatus) ?? rawStatus;
  const question = questionFrom(result, missionId);

  if (question || rawStatus === "needs-input") {
    return { missionId, state: "needs-input", step: "consult", label: "Gérard a besoin d’un détail", description: question?.reason, progress: 0.45, question, finished: false };
  }
  if (cached?.error || status === "failed") {
    return { missionId, state: "failed", step: "blocked", label: "Gérard n’a pas pu terminer", description: cached?.error || text(result.summary) || text(operation.activity), progress: 1, finished: false };
  }
  if (status === "blocked") {
    return { missionId, state: "blocked", step: "blocked", label: "Gérard attend une autorisation", description: text(result.summary) || text(operation.activity), progress: 0.5, finished: false };
  }
  if (status === "ready" || ["completed", "complete", "success", "done"].includes(rawStatus)) {
    return { missionId, state: "harvest-ready", step: "done", label: "Gérard revient avec la récolte", description: text(result.summary) || "La récolte est prête.", progress: 1, finished: true };
  }
  if (["queued", "accepted", "recorded"].includes(rawStatus)) {
    return { missionId, state: "submitted", step: "prepare", label: "Gérard prépare son sac", description: text(operation.activity), progress: 0.18, finished: false };
  }
  return { missionId, state: "working", step: "craft", label: "Gérard cultive la demande", description: text(result.summary) || text(operation.activity) || "Octopus coordonne le travail.", progress: 0.68, finished: false };
}

function harvestFromRaw(raw: UnknownRecord): Harvest | null {
  const output = record(raw.output);
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts.map(record) : [];
  const artifact = artifacts[0] ?? record(raw.artifact);
  const content = text(artifact.content) || text(artifact.artifact) || text(output.text) || text(raw.content);
  const url = text(artifact.url) || text(artifact.previewUrl) || text(raw.url) || text(raw.preview);
  const mime = text(artifact.mimeType) || text(artifact.type);
  const title = text(artifact.title) || text(raw.title) || "Récolte de Gérard";

  if (url && mime.startsWith("image/")) {
    return { kind: "visual", status: "ready-to-use", title, previewUrl: url, caption: content, format: mime, dimensions: text(record(artifact.metadata).dimensions) || "", downloadUrl: text(artifact.downloadUrl) || url };
  }
  if (Array.isArray(raw.contacts)) {
    const contacts = raw.contacts.map(record).map((contact) => ({
      name: text(contact.name), role: text(contact.role), organization: text(contact.organization), reason: text(contact.reason), source: text(contact.source), contact: text(contact.contact), status: text(contact.status),
    }));
    return { kind: "contact-list", status: "ready-to-review", title, summary: text(raw.summary), contacts };
  }
  if (content) return { kind: "text", status: "ready-to-use", title, body: content };
  if (url) return { kind: "visual", status: "ready-to-review", title, previewUrl: url, caption: "", format: mime || "fichier", dimensions: "", downloadUrl: url };
  return null;
}

export const browserPoulpeRuntimeAdapter: PoulpeRuntimeAdapter = {
  async getClientContext() {
    return clientContext();
  },

  async listParcels() {
    const access = record(window.PoulpeAccess?.snapshot?.());
    const visibleId = text(access.parcelId);
    return (garden().parcels ?? [])
      .map(record)
      .filter((parcel) => !visibleId || text(parcel.id) === visibleId)
      .map(toParcel)
      .filter((parcel) => Boolean(parcel.id));
  },

  async startCultivation(intent) {
    const runtime = window.PoulpeOctopusAdapter;
    if (!runtime?.dispatch) throw new Error("Le lien existant vers Octopus n’est pas chargé.");
    const missionId = `mobile-v2-${Date.now()}`;
    missions.set(missionId, { intent });
    const parcel = (garden().parcels ?? []).map(record).find((item) => text(item.id) === intent.parcelId);
    const payload: UnknownRecord = {
      operationId: missionId,
      parcelId: intent.parcelId,
      title: `Culture · ${intent.goal}`,
      objective: intent.goal,
      intent: intent.goal,
      context: {
        id: intent.parcelId,
        label: text(parcel?.name) || intent.parcelId,
        objective: intent.goal,
        metadata: { owner: "poulpe-fiction-mobile-v2", audience: intent.audience, format: intent.format, details: intent.details },
      },
      authorizedResources: ["publisher"],
      authorizationPolicy: { internalWork: "allowed", externalAction: "requires-human-approval" },
      prompt: [
        `Projet: ${text(parcel?.name) || intent.parcelId}`,
        `Contexte connu: ${parcelDescription(parcel ?? {})}`,
        `Demande: ${intent.goal}`,
        intent.audience ? `Public: ${intent.audience}` : "",
        intent.format ? `Ton ou format: ${intent.format}` : "",
        intent.details ? `Détails: ${intent.details}` : "",
        "N’invente aucune donnée professionnelle, aucun contact et aucune source. Si une information indispensable manque, retourne needs-input avec une question précise.",
      ].filter(Boolean).join("\n"),
    };
    void runtime.dispatch(payload, { kind: "mobile-v2" }).then((response) => {
      const current = missions.get(missionId);
      if (current) missions.set(missionId, { ...current, result: record(record(response).result) });
    }).catch((error: unknown) => {
      const current = missions.get(missionId);
      if (current) missions.set(missionId, { ...current, error: error instanceof Error ? error.message : String(error) });
    });
    return { missionId };
  },

  async getMissionProgress(missionId) {
    return progressFor(missionId);
  },

  async answerQuestion(missionId, questionId, answer) {
    const current = missions.get(missionId);
    const runtime = window.PoulpeOctopusAdapter;
    if (!current || !runtime?.dispatch) throw new Error("La mission à reprendre est introuvable.");
    const resumeId = `${missionId}-resume-${Date.now()}`;
    const response = await runtime.dispatch({
      operationId: resumeId,
      parentMissionId: missionId,
      parcelId: current.intent.parcelId,
      title: "Complément demandé par Gérard",
      objective: current.intent.goal,
      type: "mission.input",
      answers: { [questionId]: answer },
      context: { id: current.intent.parcelId, metadata: { missionId, questionId } },
      prompt: `Reprends la mission ${missionId}. Réponse à ${questionId}: ${String(answer)}. N’invente pas les autres informations manquantes.`,
    }, { kind: "mission-input" });
    missions.set(missionId, { ...current, result: record(record(response).result) });
    return progressFor(missionId);
  },

  async getLatestHarvest(missionId) {
    const cached = missions.get(missionId);
    const rawResult = record(cached?.result);
    let harvest = harvestFromRaw(rawResult);
    if (!harvest) {
      const gardenHarvest = (garden().harvests ?? []).map(record).find((item) => text(item.missionId) === missionId || text(item.operationId) === missionId || text(item.id) === missionId);
      if (gardenHarvest) harvest = harvestFromRaw(gardenHarvest);
    }
    if (!harvest || !cached) return null;
    return { missionId, createdAt: new Date().toISOString(), intent: cached.intent, harvest } as HarvestBundle;
  },

  async requestAuthorization() {
    return { granted: false };
  },
};
