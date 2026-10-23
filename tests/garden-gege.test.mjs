import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptOctopus,
  adaptGerard,
  mergeEvents,
  parseSnapshot,
  projectMissions,
  safeResultUrl,
  visualState,
} from "../src/garden-gege/core.mjs";
// Explicitly synthetic data; no production endpoint is contacted by this suite.
const event = (patch = {}) => ({
  id: "demo-1",
  missionId: "demo-m1",
  projectId: "demo-parcel",
  agentRole: "tresseur",
  title: "FICTIF · rédaction",
  type: "demo.running",
  status: "running",
  timestamp: "2026-10-23T10:00:00Z",
  sourceSystem: "demo",
  sourceEventId: "1",
  provenance: "demo",
  ...patch,
});
const projects = [{ id: "test-parcel", label: "FICTIF · parcelle de test" }];
const raw = (kind, id, time = "2026-10-23T10:00:00Z") => ({
  id,
  streamId: "test-operation",
  kind,
  occurredAt: time,
  source: "octopus-engine",
  payload: {
    contextId: "test-parcel",
    requiredCapabilities: ["copy.generate"],
  },
});
test("live projection rejects demo, even if the envelope is relabelled", () => {
  assert.equal(projectMissions([event()], "real").length, 0);
  assert.equal(
    projectMissions([event({ provenance: "real" })], "real").length,
    0,
  );
  const input = {
    schemaVersion: 1,
    mode: "demo",
    transport: "snapshot",
    coverage: "partial",
    sourceRef: "demo",
    generatedAt: "2026-10-23T10:00:00Z",
    projects: [],
    events: [],
  };
  assert.throws(() => parseSnapshot(input, "real"));
});
test("deduplication, reconnect and out-of-order delivery preserve failure history", () => {
  const fail = event({
    id: "demo-2",
    sourceEventId: "2",
    status: "failed",
    timestamp: "2026-10-23T10:01:00Z",
  });
  const retry = event({
    id: "demo-3",
    sourceEventId: "3",
    status: "retrying",
    timestamp: "2026-10-23T10:02:00Z",
  });
  const done = event({
    id: "demo-4",
    sourceEventId: "4",
    status: "completed",
    timestamp: "2026-10-23T10:03:00Z",
  });
  const merged = mergeEvents([fail, event()], [done, retry, fail], "demo");
  assert.equal(merged.events.length, 4);
  const [m] = projectMissions(merged.events, "demo");
  assert.equal(m.status, "completed");
  assert.equal(m.history.filter((e) => e.status === "failed").length, 1);
  assert.equal(m.startedAt, event().timestamp);
  assert.equal(m.completedAt, done.timestamp);
  assert.equal(m.errorMessage, undefined);
  assert.equal(mergeEvents(merged.events, [], "demo").events.length, 4);
});
test("conflicting duplicate cannot rewrite a failure as success", () => {
  const original = event({ status: "failed" });
  const result = mergeEvents(
    [original],
    [event({ status: "completed" })],
    "demo",
  );
  assert.equal(result.events[0].status, "failed");
  assert.equal(result.rejectedCount, 1);
});
test("unknown statuses, malformed timestamps, missing data and unknown projects are excluded", () => {
  const merged = mergeEvents(
    [],
    [
      event({ status: "unknown" }),
      event({ timestamp: "nope" }),
      {},
      event({ agentRole: "__proto__" }),
    ],
    "demo",
  );
  assert.equal(merged.events.length, 0);
  assert.equal(merged.rejectedCount, 4);
  assert.throws(() => adaptOctopus({}, projects));
  assert.throws(() => adaptGerard({}, projects));
  const result = adaptOctopus(
    {
      events: [
        raw("mission.magic", "t1"),
        {
          ...raw("mission.completed", "t2"),
          payload: { contextId: "missing" },
        },
      ],
    },
    projects,
  );
  assert.equal(result.events.length, 0);
  assert.equal(result.rejectedCount, 2);
});
test("Octopus lifecycle maps observed states and never invents intermediate events", () => {
  const result = adaptOctopus(
    {
      events: [
        raw("mission.received", "t1"),
        raw("mission.executing", "t2", "2026-10-23T10:01:00Z"),
        raw("mission.failed", "t3", "2026-10-23T10:02:00Z"),
      ],
    },
    projects,
  );
  assert.deepEqual(
    result.events.map((e) => e.status),
    ["queued", "running", "failed"],
  );
  const [m] = projectMissions(result.events, "real");
  assert.equal(m.agentRole, "tresseur");
  assert.equal(m.status, "failed");
  assert.equal(m.resultUrl, undefined);
  assert.equal(adaptOctopus({ events: [] }, projects).events.length, 0);
});
test("authorization and absent executor remain blocked, never completed or running", () => {
  for (const kind of [
    "mission.waiting-authorization",
    "mission.waiting-executor",
  ])
    assert.equal(
      adaptOctopus({ events: [raw(kind, "test-event")] }, projects).events[0]
        .status,
      "blocked",
    );
});
test("source payloads, raw errors and unsafe URLs do not reach the browser contract", () => {
  const secret = "test-secret-not-real";
  const input = raw("mission.failed", "test-event");
  input.payload.token = secret;
  input.payload.summary = secret;
  input.payload.output = { apiKey: secret };
  assert.ok(
    !JSON.stringify(adaptOctopus({ events: [input] }, projects)).includes(
      secret,
    ),
  );
  for (const url of [
    "javascript:alert(1)",
    "http://benoitlub.github.io/file",
    "https://user:pass@benoitlub.github.io/file",
    "https://benoitlub.github.io/file?token=x",
    "https://evil.example/file",
    "https://benoitlub.github.io/file#token",
  ])
    assert.equal(safeResultUrl(url), undefined);
  assert.equal(
    safeResultUrl("https://benoitlub.github.io/public/result.html"),
    "https://benoitlub.github.io/public/result.html",
  );
  assert.ok(
    !JSON.stringify(
      mergeEvents(
        [],
        [
          event({
            payload: { token: secret },
            errorMessage: secret,
            status: "failed",
          }),
        ],
        "demo",
      ),
    ).includes(secret),
  );
});
test("Gérard cycle success is internal work, never proof of publication", () => {
  const sample = {
    learningHistory: [
      {
        operationId: "test-cycle",
        at: "2026-10-23T10:00:00Z",
        parcelId: "test-parcel",
        mode: "cultivate",
        outcome: "ok",
        intention: "PRIVATE",
        decision: "harvest-produced",
      },
    ],
  };
  const result = adaptGerard(sample, projects);
  assert.equal(result.events[0].resultKind, "internal-cycle");
  assert.equal(result.events[0].resultUrl, undefined);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("blocked movement freezes, completion removes the route without deleting history", () => {
  assert.deepEqual(visualState({ status: "blocked" }), {
    route: true,
    moving: false,
    blocked: true,
    delivered: false,
  });
  assert.equal(visualState({ status: "running" }).moving, true);
  assert.equal(visualState({ status: "completed" }).route, false);
  assert.equal(visualState({ status: "queued" }).moving, false);
});
test("snapshot strips unexpected properties and cannot cross modes", () => {
  const base = {
    schemaVersion: 1,
    mode: "demo",
    transport: "snapshot",
    coverage: "partial",
    sourceRef: "demo",
    generatedAt: "2026-10-23T10:00:00Z",
    projects: [{ id: "demo-parcel", label: "FICTIF", secret: "PRIVATE" }],
    events: [event()],
    secret: "PRIVATE",
  };
  assert.ok(!JSON.stringify(parseSnapshot(base, "demo")).includes("PRIVATE"));
  assert.throws(() => parseSnapshot({ ...base, transport: "live" }, "demo"));
});
