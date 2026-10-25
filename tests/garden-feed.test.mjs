import test from "node:test";
import assert from "node:assert/strict";
import { buildFeed, adaptHarvests } from "../src/garden-gege/feed.mjs";
import {
  projectMissions,
  adaptGerard,
  adaptOctopus,
} from "../src/garden-gege/core.mjs";
import { createGardenPoller } from "../src/garden-gege/reader.mjs";
// All fixtures are synthetic; tests do not call production.
const observedAt = "2026-10-25T10:00:00Z";
const seeds = { seeds: [{ parcelId: "poulpe-fiction" }] };
const projects = [{ id: "poulpe-fiction", label: "Test fixture" }];
const cycle = {
  operationId: "gerard-cultivate-123",
  mode: "cultivate",
  parcelId: "poulpe-fiction",
  at: "2026-10-25T09:01:00Z",
  outcome: "ok",
  decision: "harvest-produced",
};
const harvest = {
  harvestId: "gerard-cultivate-123-harvest",
  parcelId: "poulpe-fiction",
  harvestedAt: "2026-10-25T09:00:00Z",
  state: "harvested",
  capability: "content.generate",
  route: "octopus->publisher-adapter",
  content: "SYNTHETIC TEST ONLY: secret lead must never leave collector",
};
const feed = () =>
  buildFeed({
    seeds,
    state: { learningHistory: [cycle] },
    harvests: { harvests: [harvest] },
    octopus: { events: [] },
    sourceRef: "test-fixture",
    observedAt,
  });
test("exact audited operation ID correlates cycle and actual harvest, without content disclosure", () => {
  const s = feed();
  const m = projectMissions(s.events, "real");
  assert.equal(m.length, 1);
  assert.equal(m[0].history.length, 2);
  assert.equal(m[0].resultKind, "harvest");
  assert.ok(!JSON.stringify(s).includes(harvest.content));
  assert.equal(m[0].resultUrl, undefined);
  assert.equal(s.sources.length, 3);
});
test("quota and rejected mock decisions override ok as blocked", () => {
  for (const decision of ["ai-rate-limited-deferred", "mock-rejected-deferred"])
    assert.equal(
      adaptGerard({ learningHistory: [{ ...cycle, decision }] }, projects)
        .events[0].status,
      "blocked",
    );
});
test("mock, compost, unknown routes and empty output cannot become harvest successes", () => {
  for (const patch of [
    { simulated: true },
    { isMock: true },
    { producer: "mock" },
    { verification: { simulated: true } },
    { state: "composted" },
    { state: "archived" },
    { content: "" },
    { route: "unknown" },
    { harvestId: "invented" },
    { parcelId: "unconfigured" },
  ])
    assert.equal(
      adaptHarvests({ harvests: [{ ...harvest, ...patch }] }, projects).events
        .length,
      0,
    );
});
test("missing sources are visible and a valid empty source remains calm", () => {
  const s = buildFeed({
    seeds,
    state: undefined,
    harvests: undefined,
    octopus: { events: [] },
    sourceRef: "test-fixture",
    observedAt,
  });
  assert.equal(s.events.length, 0);
  assert.equal(s.sources.filter((x) => x.state === "unavailable").length, 2);
  assert.throws(() =>
    buildFeed({ seeds, sourceRef: "test-fixture", observedAt }),
  );
  assert.throws(() =>
    buildFeed({
      state: { learningHistory: [] },
      sourceRef: "test-fixture",
      observedAt,
    }),
  );
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
test("poller uses GET only, deduplicates, preserves history offline, pauses and reconnects", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0,
    fail = false;
  const updates = [];
  const poller = createGardenPoller({
    intervalMs: 100,
    timeoutMs: 50,
    onUpdate: (u) => updates.push(u),
    fetcher: async (url, options) => {
      calls++;
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit");
      if (fail) throw Error("private raw diagnostic");
      return new Response(JSON.stringify(feed()));
    },
  });
  poller.start();
  await flush();
  assert.equal(updates.at(-1).connection, "connected");
  assert.equal(calls, 1);
  t.mock.timers.tick(100);
  await flush();
  assert.equal(updates.at(-1).snapshot.events.length, 2);
  assert.equal(calls, 2);
  fail = true;
  t.mock.timers.tick(100);
  await flush();
  assert.equal(updates.at(-1).connection, "offline");
  assert.equal(updates.at(-1).snapshot.events.length, 2);
  poller.setVisible(false);
  t.mock.timers.tick(10000);
  await flush();
  assert.equal(calls, 3);
  fail = false;
  poller.setVisible(true);
  await flush();
  assert.equal(calls, 4);
  assert.equal(updates.at(-1).connection, "connected");
  poller.stop();
});
test("late response and demo envelope cannot replace the real feed", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve;
  const updates = [];
  const poller = createGardenPoller({
    onUpdate: (u) => updates.push(u),
    fetcher: () => new Promise((r) => (resolve = r)),
  });
  poller.start();
  poller.stop();
  resolve(new Response(JSON.stringify(feed())));
  await flush();
  assert.ok(updates.every((u) => u.connection === "loading"));
  const invalid = createGardenPoller({
    onUpdate: (u) => updates.push(u),
    fetcher: async () =>
      new Response(JSON.stringify({ ...feed(), mode: "demo" })),
  });
  invalid.start();
  await flush();
  assert.equal(updates.at(-1).connection, "invalid");
  assert.equal(updates.at(-1).snapshot, null);
  invalid.stop();
});

test("mock flags nested in Octopus output never become real events", () => {
  const source = {
    events: [
      {
        id: "test-event",
        streamId: "test-operation",
        kind: "mission.completed",
        occurredAt: observedAt,
        payload: { contextId: "poulpe-fiction", output: { isMock: true } },
      },
    ],
  };
  assert.equal(adaptOctopus(source, projects).events.length, 0);
});
