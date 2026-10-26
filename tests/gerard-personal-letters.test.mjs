import test from "node:test";
import assert from "node:assert/strict";
import { proposeGerardLetter } from "../scripts/gerard-personal-letters.mjs";

const at = "2026-10-26T18:00:00.000Z";
const event = { at, decision: "harvest-produced", outcome: "ok", operationId: "gerard-cultivate-abc", parcelId: "poulpe-fiction" };
const harvest = { harvestId: "gerard-cultivate-abc-harvest", seedId: "terra", parcelId: "poulpe-fiction", title: "Une histoire nouvelle", content: "Un texte authentique.", state: "harvested" };
const generate = (changes = {}) => proposeGerardLetter({
  state: { learningHistory: [event] }, harvests: { harvests: [harvest] },
  existing: { letters: [] }, now: new Date("2026-10-26T20:00:00.000Z"), ...changes
});
test("creates one grounded Banc letter with no email transmission", () => {
  const got = generate();
  assert.equal(got.created, true);
  assert.equal(got.sendingEnabled, false);
  assert.equal(got.audience, "owner-only");
  assert.equal(got.letters.length, 1);
  assert.equal(got.letters[0].delivery.sentAt, null);
  assert.equal(got.letters[0].delivery.status, "gmail-not-connected");
  assert.match(got.letters[0].body, /Une histoire nouvelle/);
});
test("seven day rolling limit and no repeated topic", () => {
  const first = generate();
  assert.equal(generate({ existing: first, now: new Date("2026-10-29T20:00:00.000Z") }).created, false);
  assert.equal(generate({ existing: first, now: new Date("2026-11-03T20:00:00.000Z") }).created, false);
});
test("silence when no event or nonexistent/composted or mock harvest", () => {
  assert.equal(generate({ state: { learningHistory: [] } }).created, false);
  assert.equal(generate({ harvests: { harvests: [] } }).created, false);
  assert.equal(generate({ harvests: { harvests: [{ ...harvest, state: "composted" }] } }).created, false);
  assert.equal(generate({ harvests: { harvests: [{ ...harvest, content: "Mode mock actif" }] } }).created, false);
});
test("does not treat errors and stale events as achievements", () => {
  assert.equal(generate({ state: { learningHistory: [{ ...event, outcome: "failed" }] } }).created, false);
  assert.equal(generate({ now: new Date("2026-11-06T20:00:00.000Z") }).created, false);
});
test("invalid clock fails closed without archive loss", () => {
  const first = generate();
  const second = generate({ existing: first, now: new Date("invalid") });
  assert.equal(second.created, false);
  assert.equal(second.letters.length, 1);
});
