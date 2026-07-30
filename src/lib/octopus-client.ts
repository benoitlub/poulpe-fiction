const API_URL = import.meta.env.VITE_OCTOPUS_API_URL || 'http://localhost:3000';

export interface MissionContext {
  id: string;
  label?: string;
  objective?: string;
  metadata?: Record<string, unknown>;
}

export interface MissionRequest {
  operationId?: string;
  title: string;
  objective: string;
  requiredCapabilities: string[];
  authorizedResources?: string[];
  context: MissionContext;
  prompt?: string;
}

export interface MissionResponse {
  status: 'completed' | 'waiting-executor' | 'waiting-authorization' | 'failed' | 'rejected';
  operationId: string;
  missionId: string;
  contextId: string;
  summary: string;
  output?: Record<string, unknown>;
  lifecycle?: unknown;
}

export const octopus = {
  async health(): Promise<{ status: string; mode: string }> {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error('Octopus Engine hors ligne');
    return res.json();
  },

  async brief(): Promise<{ brief: string; resources: unknown }> {
    const res = await fetch(`${API_URL}/brief`);
    return res.json();
  },

  async createMission(mission: MissionRequest): Promise<MissionResponse> {
    const res = await fetch(`${API_URL}/mission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mission),
    });
    return res.json();
  },

  async getMission(id: string): Promise<MissionResponse> {
    const res = await fetch(`${API_URL}/missions/${id}`);
    return res.json();
  },

  async getEvents(): Promise<{ events: unknown[] }> {
    const res = await fetch(`${API_URL}/events`);
    return res.json();
  },
};
