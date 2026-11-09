import type { AgentRole, GardenMission } from "@/garden-gege/contracts";
import { visualState } from "@/garden-gege/core.mjs";
import type { HamsterPose } from "./Hamster";

export type Selection =
  | { kind: "role"; role: AgentRole }
  | { kind: "gerard" }
  | { kind: "parcel"; projectId: string }
  | { kind: "compost" };

/** Latest observed mission per trade (missions are already sorted newest first). */
export function latestByRole(missions: GardenMission[]): Partial<Record<AgentRole, GardenMission>> {
  const out: Partial<Record<AgentRole, GardenMission>> = {};
  for (const m of missions) if (!out[m.agentRole]) out[m.agentRole] = m;
  return out;
}

/** Gesture derives only from the observed status — never from time. */
export function poseFor(m: GardenMission | undefined, role: AgentRole): HamsterPose {
  if (!m) return "idle";
  switch (m.status) {
    case "running":
      return role === "passeur" ? "scurry" : "work";
    case "retrying":
      return "retry";
    case "queued":
      return "wait";
    case "blocked":
    case "failed":
      return "puzzled";
    case "completed":
      return "happy";
  }
}

/** Gérard's mood derives only from observed statuses. */
export function gerardMood(missions: GardenMission[]): "calm" | "busy" | "concerned" {
  if (missions.some((m) => m.status === "running" || m.status === "retrying")) return "busy";
  if (missions.some((m) => m.status === "failed" || m.status === "blocked")) return "concerned";
  return "calm";
}

export function routeFor(m: GardenMission | undefined) {
  return m ? visualState(m) : { route: false, moving: false, blocked: false, delivered: false };
}

export const STATUS_TONE: Record<GardenMission["status"], string> = {
  queued: "var(--g-status-queued)",
  running: "var(--g-status-running)",
  completed: "var(--g-status-completed)",
  blocked: "var(--g-status-blocked)",
  failed: "var(--g-status-failed)",
  retrying: "var(--g-status-retrying)",
};

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}