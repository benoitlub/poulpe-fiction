import { mergeEvents, parseSnapshot } from "./core.mjs";
export const GARDEN_FEED_URL =
  "https://blacklace-publisher-worker.benoitlubert.workers.dev/api/garden/v1/snapshot";
/** One outstanding GET at most. Hidden tabs stop polling; failures preserve already observed history. */
export function createGardenPoller({
  onUpdate,
  fetcher = fetch,
  endpoint = GARDEN_FEED_URL,
  intervalMs = 60000,
  timeoutMs = 20000,
}) {
  let snapshot = null,
    stopped = true,
    visible = true,
    timer,
    controller,
    generation = 0,
    failures = 0;
  function cancel() {
    generation++;
    clearTimeout(timer);
    controller?.abort();
  }
  async function read() {
    if (stopped || !visible) return;
    cancel();
    const mine = generation;
    const requestController = new AbortController();
    controller = requestController;
    const signal = requestController.signal;
    if (!snapshot) onUpdate({ snapshot: null, connection: "loading" });
    const timeout = setTimeout(() => requestController.abort(), timeoutMs);
    let connection = "offline";
    try {
      const response = await fetcher(endpoint, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("offline");
      try {
        const next = parseSnapshot(await response.json(), "real");
        if (mine !== generation || stopped || !visible) return;
        // Existing observed failures survive a partial or truncated upstream snapshot.
        const merged = mergeEvents(snapshot?.events ?? [], next.events, "real");
        snapshot = {
          ...next,
          events: merged.events,
          rejectedCount: next.rejectedCount + merged.rejectedCount,
        };
        connection = next.sources?.some((s) => s.state === "unavailable")
          ? "partial"
          : "connected";
        failures = 0;
      } catch {
        connection = "invalid";
        failures++;
      }
    } catch {
      failures++;
    } finally {
      clearTimeout(timeout);
    }
    if (mine !== generation || stopped || !visible) return;
    onUpdate({ snapshot, connection });
    timer = setTimeout(
      read,
      Math.min(300000, intervalMs * 2 ** Math.min(failures, 3)),
    );
  }
  return {
    start() {
      stopped = false;
      void read();
    },
    refresh() {
      void read();
    },
    setVisible(value) {
      visible = value;
      if (!visible) cancel();
      else if (!stopped) void read();
    },
    stop() {
      stopped = true;
      cancel();
    },
  };
}
