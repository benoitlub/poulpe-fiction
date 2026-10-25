import type { ConnectionState, GardenSnapshot } from "./contracts.js";
export const GARDEN_FEED_URL: string;
export function createGardenPoller(options: {
  onUpdate: (update: {
    snapshot: GardenSnapshot | null;
    connection: ConnectionState;
  }) => void;
  fetcher?: typeof fetch;
  endpoint?: string;
  intervalMs?: number;
  timeoutMs?: number;
}): {
  start(): void;
  refresh(): void;
  setVisible(value: boolean): void;
  stop(): void;
};
