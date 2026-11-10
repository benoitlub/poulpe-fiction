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
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    if (!source) {
      setConnection("offline");
      setError("Aucune source réelle n'est configurée.");
      return () => ctrl.abort();
    }

    // A new source must not inherit missions or traces from the previous mode.
    setSnapshot(null);
    setEvents([]);
    setConnection("loading");
    setError(null);

    const refresh = async () => {
      if (ctrl.signal.aborted) return;
      if (typeof document !== "undefined" && document.hidden && source.kind === "real") {
        timer = setTimeout(refresh, 60_000);
        return;
      }
      try {
        const s = await source.load(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setSnapshot(s);
        setEvents((prev) => mergeEvents(prev, s.events, s.mode).events);
        setConnection("snapshot");
        setError(null);
        failures = 0;
      } catch (e: unknown) {
        if (ctrl.signal.aborted) return;
        setConnection(e instanceof Error && e.message.includes("invalide") ? "invalid" : "offline");
        setError(e instanceof Error ? e.message : "Source indisponible");
        failures++;
      }
      if (!ctrl.signal.aborted && source.kind === "real") {
        timer = setTimeout(refresh, Math.min(300_000, 60_000 * 2 ** Math.min(failures, 3)));
      }
    };

    const onVisible = () => {
      if (!document.hidden && source.kind === "real") {
        if (timer) clearTimeout(timer);
        timer = undefined;
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void refresh();
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
