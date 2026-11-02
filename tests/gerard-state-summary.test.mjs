import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCycleResult, summarizeStateResult } from "../scripts/gerard-state-summary.mjs";

test("public cycle summary excludes nested private source and generated content", () => {
  const privateText = "PRIVATE_SOURCE_SENTINEL";
  const result = {
    status: "ok", operationId: "cycle-1", seedId: "sample", harvestMode: "garden-prepare-bag",
    knowledge: { verified: true, slug: "sample" },
    octopus: { status: "ok", httpStatus: 200, payload: { status: "completed", summary: privateText,
      output: { capability: "knowledge.search", context: privateText, itemCount: 1,
        items: [{ content: privateText }], diagnostics: { connected: true, error: privateText } } } },
    harvest: { status: "ok", payload: { output: { text: privateText, futurePrivateField: privateText } },
      verification: { completed: true, simulated: false, contentLength: 24 } },
    persistedHarvest: { harvestId: "harvest-1", content: privateText, title: privateText,
      delivery: { recipient: "private@example.invalid", mode: "review", harvestState: "ready-to-offer" } },
    error: privateText, unknownFutureResponse: { text: privateText },
  };
  const summary = summarizeCycleResult(result);
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_SOURCE_SENTINEL|private@example|futurePrivateField|unknownFutureResponse/);
  assert.equal(summary.octopus.payload.output.itemCount, 1);
  assert.equal(summary.harvest.verification.completed, true);
  assert.equal(summary.harvest.verification.simulated, false);
  assert.equal(summary.persistedHarvest.harvestId, "harvest-1");
  assert.equal(summary.status, "ok");
  assert.equal(result.harvest.payload.output.text, privateText, "in-memory result is not mutated");
});

test("summary retains failed and deferred operational outcomes without raw errors", () => {
  for (const status of ["failed", "deferred"]) {
    const result = summarizeCycleResult({ status, verification: { processed: 0, reason: "no-executor" },
      deferred: { retryAt: "2026-11-02T09:00:00.000Z", reason: "429: contact private@example.invalid" },
      source: "https://private.invalid/source", error: "private details" });
    assert.equal(result.status, status);
    assert.equal(result.verification.processed, 0);
    assert.equal(result.verification.reason, "no-executor");
    assert.equal(result.deferred.retryAt, "2026-11-02T09:00:00.000Z");
    assert.equal(result.deferred.reason, undefined);
    assert.equal(result.source, undefined);
  }
});

test("summary cannot erase mock evidence and turn a simulation into a real result", () => {
  const result = summarizeCycleResult({ status: "ok", payload: { output: {
    isMock: true, mock: true, simulated: true, provenance: "demo", producer: "mock", text: "not real",
  } } });
  assert.deepEqual(result.payload.output, { isMock: true, mock: true, simulated: true, provenance: "demo", producer: "mock" });
});

test("summary is idempotent and preserves rotation, cooldown and learning memory", () => {
  const state = { lastSeedId: "seed-1", aiCooldownUntil: "2026-11-02T09:00:00.000Z",
    history: [{ mode: "cultivate", result: "ok" }], learningHistory: [{ outcome: "failed" }],
    businessSourceMemory: { known: { examinedAt: "2026-11-01" } },
    lastResult: { status: "ok", payload: { output: { context: "PRIVATE_SOURCE_SENTINEL" } } } };
  const summary = summarizeStateResult(state);
  for (const key of ["lastSeedId", "aiCooldownUntil", "history", "learningHistory", "businessSourceMemory"]) assert.deepEqual(summary[key], state[key]);
  assert.deepEqual(summarizeStateResult(summary), summary);
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_SOURCE_SENTINEL/);
  assert.deepEqual(summarizeCycleResult(null), {});
});
