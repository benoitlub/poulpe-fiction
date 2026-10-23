import test from "node:test";
import assert from "node:assert/strict";
import { metricoolMission, submitMetricoolPublication } from "../scripts/gerard-metricool-publication.mjs";

const candidate = { status: "ready", harvestId: "harvest-1", seedId: "blacklace-dice",
  copy: { text: "Une décision de Gérard." }, media: null, compatibleNetworks: ["facebook"],
  transport: { provider: "metricool" }, editorialRoute: { destination: { preferredProvider: "metricool" } } };
test("Gerard requests the existing Octopus social.publish capability and defaults to preview", () => {
  const mission = metricoolMission(candidate);
  assert.deepEqual(mission.requiredCapabilities, ["social.publish"]);
  assert.deepEqual(mission.authorizedResources, ["social.publish"]);
  assert.equal(mission.context.metadata.socialPublication.dryRun, true);
  assert.ok(!("publicationDate" in mission.context.metadata.socialPublication));
  assert.deepEqual(mission.context.metadata.socialPublication.networks, ["facebook"]);
});
test("publication key survives clock changes; an altered artifact gets a new key", () => {
  const one = metricoolMission(candidate, { now: new Date(1) });
  const two = metricoolMission(candidate, { now: new Date(2) });
  assert.notEqual(one.operationId, two.operationId);
  assert.equal(one.context.metadata.socialPublication.operationId, two.context.metadata.socialPublication.operationId);
  assert.notEqual(one.context.metadata.socialPublication.operationId, metricoolMission({ ...candidate, copy: { text: "Autre" } }).context.metadata.socialPublication.operationId);
});
test("books routed to Buffer and blocked candidates never enter Metricool", () => {
  for (const value of [{ ...candidate, action: "do-not-schedule" }, { ...candidate, status: "blocked" }, { ...candidate, transport: { provider: "buffer" } }]) assert.equal(metricoolMission(value), null);
});
test("an image does not add Instagram to Gerard's Facebook-only decision", () => {
  assert.deepEqual(metricoolMission({ ...candidate, media: { url: "https://example.org/image.png" } }).context.metadata.socialPublication.networks, ["facebook"]);
  assert.equal(metricoolMission({ ...candidate, compatibleNetworks: ["facebook", "unknown"] }), null);
});
test("only provider-confirmed scheduled outcomes become confirmed deliveries", async () => {
  const updated = await submitMetricoolPublication(candidate, { execute: true, fetchImpl: async (url, init) => {
    assert.equal(url, "http://127.0.0.1:3000/mission");
    assert.equal(JSON.parse(init.body).context.metadata.socialPublication.dryRun, false);
    return Response.json({ status: "completed", output: { status: "confirmed-scheduled", scheduled: true, postId: "42", publicationDate: "2026-10-23T12:00:00" } });
  } });
  assert.equal(updated.delivery.status, "confirmed-scheduled"); assert.equal(updated.metricoolHandoff.postId, "42");
});
test("acceptance/ID alone, quota blocks and timeouts remain unconfirmed and retain ready content", async () => {
  for (const fetchImpl of [
    async () => Response.json({ status: "completed", output: { postId: "42" } }),
    async () => Response.json({ status: "waiting-authorization", output: { status: "quota-exhausted", scheduled: false, stage: "verified-budget" } }),
    async () => { throw new Error("timeout"); },
  ]) {
    const updated = await submitMetricoolPublication(candidate, { fetchImpl });
    assert.equal(updated.delivery.publishingEnabled, false);
    assert.equal(updated.status, "ready"); assert.deepEqual(updated.copy, candidate.copy);
    assert.ok(updated.metricoolHandoff.operationId);
  }
});

test("Buffer requires Gerard's exact channel, image and single Instagram destination", async () => {
  const { bufferMission, submitBufferPublication } = await import("../scripts/gerard-metricool-publication.mjs");
  const book = { ...candidate, transport: { provider: "buffer", channelId: "chosen-channel" },
    editorialRoute: { destination: { preferredProvider: "buffer" } }, media: { url: "https://example.org/cover.jpg" }, compatibleNetworks: ["instagram"] };
  const mission = bufferMission(book);
  assert.equal(mission.context.metadata.socialPublication.transport, "buffer");
  assert.equal(mission.context.metadata.socialPublication.channelId, "chosen-channel");
  assert.equal(mission.context.metadata.socialPublication.dryRun, true);
  for (const invalid of [{ ...book, transport: { provider: "buffer" } }, { ...book, media: null }, { ...book, compatibleNetworks: ["facebook", "instagram"] }]) assert.equal(bufferMission(invalid), null);
  const out = await submitBufferPublication(book, { execute: true, fetchImpl: async (_url, init) => {
    const publication = JSON.parse(init.body).context.metadata.socialPublication;
    assert.equal(publication.text, book.copy.text); assert.deepEqual(publication.media, [book.media.url]);
    return Response.json({ status: "completed", output: { status: "confirmed-scheduled", scheduled: true, postId: "buffer-simulated" } });
  } });
  assert.equal(out.bufferHandoff.postId, "buffer-simulated"); assert.equal(out.delivery.publishingEnabled, true);
  assert.equal(metricoolMission(book), null);
});
