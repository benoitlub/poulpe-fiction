import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectionState, GardenEvent, GardenMission, GardenSnapshot, MissionStatus } from "./contracts";
import { mergeEvents, projectMissions } from "./core.mjs";
import type { GardenSource } from "./sources";

export interface GardenState {
  connection: ConnectionState;
  snapshot: GardenSnapshot | null;
  missions: GardenMission[];
  events: GardenEvent[];
  error: string | null;
  /** Demo only: explicit, user-triggered trace. Undefined in real mode. */
  addDemoTrace?: (missionId: string, status: MissionStatus) => void;
}

export function useGarden(source: GardenSource | null): GardenState {
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [events, setEvents] = useState<GardenEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setConnection("offline");
      setError("Aucune source réelle n'est configurée.");
      return;
    }
    const ctrl = new AbortController();
    setConnection("loading");
    source
      .load(ctrl.signal)
      .then((s) => {
        setSnapshot(s);
        // Keep history across reloads of a snapshot (session only).
        setEvents((prev) => mergeEvents(prev, s.events, s.mode).events);
        setConnection("snapshot");
        setError(null);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setConnection(e instanceof Error && e.message.includes("invalide") ? "invalid" : "offline");
        setError(e instanceof Error ? e.message : "Source indisponible");
      });
    return () => ctrl.abort();
  }, [source]);

  const mode = snapshot?.mode ?? "demo";
  const missions = useMemo(() => projectMissions(events, mode), [events, mode]);

  const addDemoTrace = useCallback(
    (missionId: string, status: MissionStatus) => {
      setEvents((prev) => {
        const last = [...prev].reverse().find((e) => `${encodeURIComponent(e.sourceSystem)}:${encodeURIComponent(e.missionId)}` === missionId);
        if (!last || last.provenance !== "demo") return prev;
        const n = prev.length;
        const trace: GardenEvent = {
          ...last,
          id: `demo-trace-${n}`,
          sourceEventId: `demo-trace-${n}`,
          status,
          type: `demo.${status}`,
          timestamp: new Date().toISOString(),
        };
        return mergeEvents(prev, [trace], "demo").events;
      });
    },
    [],
  );

  return {
    connection,
    snapshot,
    missions,
    events,
    error,
    ...(mode === "demo" && source?.kind === "demo" ? { addDemoTrace } : {}),
  };
}
