import type {
  GardenEvent,
  GardenSnapshot,
  MissionStatus,
  AgentRole,
} from "../../src/garden-gege/contracts";
const roles: AgentRole[] = [
  "cueilleur",
  "tresseur",
  "enlumineur",
  "passeur",
  "greffeur",
  "jardinier",
  "semeur",
];
const states: MissionStatus[] = [
  "running",
  "completed",
  "running",
  "queued",
  "failed",
  "retrying",
  "blocked",
];
const titles = [
  "Observer une idée",
  "Tresser un brouillon",
  "Enluminer une fleur",
  "Transporter une récolte",
  "Réparer une écluse",
  "Classer les graines",
  "Préparer la diffusion",
];
export const demoSnapshot: GardenSnapshot = {
  schemaVersion: 1,
  mode: "demo",
  transport: "snapshot",
  coverage: "partial",
  generatedAt: "2026-10-23T10:00:00Z",
  sourceRef: "demo-fixtures-v1",
  projects: [{ id: "demo-parcelle", label: "Parcelle de démonstration" }],
  rejectedCount: 0,
  events: roles.map((agentRole, i): GardenEvent => ({
    id: `demo-${i}`,
    missionId: `demo-mission-${i}`,
    projectId: "demo-parcelle",
    agentRole,
    title: titles[i],
    type: "demo." + states[i],
    status: states[i],
    timestamp: `2026-10-23T09:0${i}:00Z`,
    sourceSystem: "demo",
    sourceEventId: `demo-${i}`,
    provenance: "demo",
  })),
};
