import { useSyncExternalStore } from "react";
import type { ClientAccessContext, CultivationIntent, HarvestBundle, MissionId, MissionProgress, Parcel } from "./types";

export type Tab = "gerard" | "hublot" | "harvest";
export interface AnswerMap { parcelId?: string; goal?: string; audience?: string; format?: string; details?: string; }
export interface PoulpeState {
  tab: Tab;
  clientContext: ClientAccessContext | null;
  parcels: Parcel[];
  stepIndex: number;
  answers: AnswerMap;
  missionId: MissionId | null;
  progress: MissionProgress | null;
  harvest: HarvestBundle | null;
}

const initial: PoulpeState = { tab: "gerard", clientContext: null, parcels: [], stepIndex: 0, answers: {}, missionId: null, progress: null, harvest: null };
let state = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const poulpeStore = {
  get: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  set(patch: Partial<PoulpeState>) { state = { ...state, ...patch }; emit(); },
  setTab(tab: Tab) { state = { ...state, tab }; emit(); },
  setClientContext(clientContext: ClientAccessContext | null) {
    state = { ...state, clientContext, answers: clientContext ? { ...state.answers, parcelId: clientContext.parcelId } : state.answers };
    emit();
  },
  setParcels(parcels: Parcel[]) { state = { ...state, parcels }; emit(); },
  setAnswer<K extends keyof AnswerMap>(key: K, value: AnswerMap[K]) { state = { ...state, answers: { ...state.answers, [key]: value } }; emit(); },
  nextStep() { state = { ...state, stepIndex: state.stepIndex + 1 }; emit(); },
  prevStep() { state = { ...state, stepIndex: Math.max(0, state.stepIndex - 1) }; emit(); },
  setMission(missionId: MissionId) { state = { ...state, missionId, progress: null, harvest: null }; emit(); },
  setProgress(progress: MissionProgress) { state = { ...state, progress }; emit(); },
  setHarvest(harvest: HarvestBundle) { state = { ...state, harvest }; emit(); },
  resetMission() { state = { ...state, stepIndex: 0, answers: state.clientContext ? { parcelId: state.clientContext.parcelId } : {}, missionId: null, progress: null, harvest: null }; emit(); },
  buildIntent(): CultivationIntent | null {
    const { parcelId, goal, audience, format, details } = state.answers;
    if (!parcelId || !goal) return null;
    return { parcelId, goal, audience, format, details };
  },
};

export function usePoulpeStore<T>(selector: (value: PoulpeState) => T): T {
  return useSyncExternalStore(poulpeStore.subscribe, () => selector(poulpeStore.get()), () => selector(poulpeStore.get()));
}
