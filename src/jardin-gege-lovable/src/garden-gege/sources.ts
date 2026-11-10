import type { GardenSnapshot } from "./contracts";
import { parseSnapshot } from "./core.mjs";
import { demoSnapshot } from "./demo";

/**
 * A GardenSource is the only door between data and the scene.
 * Swap demo → real by choosing another source; the view never changes.
 */
export interface GardenSource {
  kind: "demo" | "real";
  label: string;
  load: (signal: AbortSignal) => Promise<GardenSnapshot>;
}

export const demoSource: GardenSource = {
  kind: "demo",
  label: "Démonstration — données fictives",
  load: async () => parseSnapshot(structuredClone(demoSnapshot), "demo"),
};

/**
 * Real snapshot reader, following Codex's phase C contract
 * (same-origin authenticated `GET …/snapshot`). The URL is configuration,
 * never hard-coded: no endpoint is invented here.
 */
export function createSnapshotSource(url: string): GardenSource {
  return {
    kind: "real",
    label: "Instantané réel",
    load: async (signal) => {
      const res = await fetch(url, { signal, credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Instantané indisponible (${res.status})`);
      return parseSnapshot(await res.json(), "real");
    },
  };
}

/** Real source only when explicitly configured; otherwise null (never a silent demo fallback). */
export function configuredRealSource(): GardenSource | null {
  const url = import.meta.env["VITE_GARDEN_SNAPSHOT_URL"] as string | undefined;
  return url ? createSnapshotSource(url) : null;
}
