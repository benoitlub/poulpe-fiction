export type ParcelId = string;
export type MissionId = string;

export type MissionState =
  | "idle"
  | "questioning"
  | "submitted"
  | "working"
  | "needs-input"
  | "harvest-ready"
  | "blocked"
  | "failed";

export interface ClientAccessContext {
  clientId: string;
  parcelId: ParcelId;
  displayName: string;
  activity?: string;
}

export interface Parcel {
  id: ParcelId;
  name: string;
  description: string;
  emoji?: string;
}

export interface CultivationIntent {
  parcelId: ParcelId;
  goal: string;
  audience?: string;
  format?: string;
  details?: string;
}

export interface RuntimeQuestion {
  id: string;
  missionId: MissionId;
  label: string;
  reason?: string;
  options?: string[];
  inputType?: "text" | "url" | "choice" | "long-text";
  scope?: "mission" | "parcel";
}

export type AuthorizationKind =
  | "publish-instagram"
  | "publish-linkedin"
  | "read-contacts"
  | "web-search";

export interface MissionProgress {
  missionId: MissionId;
  state: MissionState;
  step: "prepare" | "consult" | "think" | "craft" | "return" | "blocked" | "done";
  label: string;
  description?: string;
  progress: number;
  question?: RuntimeQuestion;
  blocked?: {
    reason: string;
    action?: { label: string; kind: AuthorizationKind };
  };
  finished: boolean;
}

export type HarvestStatus = "draft" | "ready-to-review" | "ready-to-use";

export interface ContactRow {
  name: string;
  role: string;
  organization: string;
  reason: string;
  source: string;
  contact: string;
  status: string;
}

export type Harvest =
  | { kind: "visual"; status: HarvestStatus; title: string; previewUrl: string; caption: string; format: string; dimensions: string; downloadUrl?: string }
  | { kind: "contact-list"; status: HarvestStatus; title: string; summary: string; contacts: ContactRow[] }
  | { kind: "landing"; status: HarvestStatus; title: string; previewUrl: string; copy: string; html: string }
  | { kind: "text"; status: HarvestStatus; title: string; body: string };

export interface EditorialSource {
  provider: "notion";
  pageId?: string;
  url: string;
  databaseId?: string;
  status?: "draft" | "review" | "validated" | "archived";
  lastSyncedAt?: string;
}

export interface HarvestBundle {
  missionId: MissionId;
  createdAt: string;
  intent: CultivationIntent;
  harvest: Harvest;
  editorialSource?: EditorialSource;
}
