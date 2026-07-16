import type {
  AuthorizationKind,
  ClientAccessContext,
  CultivationIntent,
  HarvestBundle,
  MissionId,
  MissionProgress,
  Parcel,
  RuntimeQuestion,
} from "../types";

/**
 * Frontend boundary only. The real Octopus monitor and adapter already exist.
 * This interface must be implemented by that existing integration, not by a
 * second runtime, store, backend or knowledge system.
 */
export interface PoulpeRuntimeAdapter {
  getClientContext(): Promise<ClientAccessContext | null>;
  listParcels(): Promise<Parcel[]>;
  startCultivation(intent: CultivationIntent): Promise<{ missionId: MissionId }>;
  getMissionProgress(missionId: MissionId): Promise<MissionProgress>;
  answerQuestion(
    missionId: MissionId,
    questionId: RuntimeQuestion["id"],
    answer: unknown,
  ): Promise<MissionProgress>;
  getLatestHarvest(missionId: MissionId): Promise<HarvestBundle | null>;
  requestAuthorization(kind: AuthorizationKind): Promise<{ granted: boolean }>;
}