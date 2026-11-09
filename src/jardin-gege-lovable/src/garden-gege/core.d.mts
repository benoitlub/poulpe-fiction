// Type declarations for Codex's core.mjs (kept verbatim). Do not add logic here.
import type {
  AgentRole,
  GardenEvent,
  GardenMission,
  GardenMode,
  GardenSnapshot,
  MissionStatus,
} from "./contracts";

export const roles: Readonly<Record<AgentRole, string>>;
export const statuses: Readonly<Record<MissionStatus, string>>;
export function safeResultUrl(value: unknown): string | undefined;
export function validateEvent(input: unknown, mode: GardenMode): GardenEvent | undefined;
export function mergeEvents(
  previous: unknown[],
  incoming: unknown[],
  mode: GardenMode,
): { events: GardenEvent[]; rejectedCount: number };
export function projectMissions(events: unknown[], mode: GardenMode): GardenMission[];
export function visualState(mission: Pick<GardenMission, "status">): {
  route: boolean;
  moving: boolean;
  blocked: boolean;
  delivered: boolean;
};
export function parseSnapshot(input: unknown, expectedMode?: GardenMode): GardenSnapshot;