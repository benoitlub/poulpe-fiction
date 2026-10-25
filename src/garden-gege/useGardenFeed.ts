import { useEffect, useRef, useState } from "react";
import type { ConnectionState, GardenMode, GardenSnapshot } from "./contracts";
import { createGardenPoller } from "./reader.mjs";

/** Portable data hook for both the current garden and Lovable's future visual components. */
export function useGardenFeed(mode: GardenMode) {
  const [state, setState] = useState<{
    snapshot: GardenSnapshot | null;
    connection: ConnectionState;
  }>({ snapshot: null, connection: "loading" });
  const poller = useRef<ReturnType<typeof createGardenPoller> | null>(null);
  useEffect(() => {
    if (mode !== "real") return;
    const reader = poller.current ?? createGardenPoller({ onUpdate: setState });
    poller.current = reader;
    const visibility = () =>
      reader.setVisible(document.visibilityState === "visible");
    const online = () => reader.refresh();
    reader.setVisible(document.visibilityState === "visible");
    reader.start();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", online);
    return () => {
      reader.stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", online);
    };
  }, [mode]);
  return { ...state, refresh: () => poller.current?.refresh() };
}
