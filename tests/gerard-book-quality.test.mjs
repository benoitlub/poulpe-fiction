import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function evaluate(value) {
  const result = spawnSync("jq", ["-f", "scripts/gerard-book-quality.jq"], {
    input: JSON.stringify(value), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.trim().length > 0, "book evaluation must never produce an empty output");
  return JSON.parse(result.stdout);
}

const base = { status: "ready", harvestId: "book-a", title: "TERRA",
  copy: { text: "TERRA est un roman de science-fiction." },
  media: { url: "https://example.org/terra.jpg", official: true } };

test("book without Amazon destination is blocked but retained as an object", () => {
  const result = evaluate(base);
  assert.equal(result.harvestId, "book-a");
  assert.equal(result.status, "blocked");
  assert.equal(result.action, "do-not-schedule");
  assert.equal(result.editorialQuality.verifiedDestination, null);
  assert.equal(result.editorialQuality.status, "incomplete");
});

test("official cover and matching verified destination remain eligible", () => {
  const value = { ...base, copy: { text: "TERRA : https://www.amazon.fr/dp/B0H4CN5MSH" } };
  const result = evaluate(value);
  assert.equal(result.status, "ready");
  assert.equal(result.editorialQuality.status, "complete");
  assert.equal(result.editorialQuality.officialCover, "https://example.org/terra.jpg");
  assert.equal(result.editorialQuality.verifiedDestination, "https://www.amazon.fr/dp/B0H4CN5MSH");
});

test("book without official cover is not made publishable by a link alone", () => {
  const value = { ...base, media: { ...base.media, official: false },
    copy: { text: "TERRA : https://www.amazon.fr/dp/B0H4CN5MSH" } };
  const result = evaluate(value);
  assert.equal(result.status, "blocked");
});

test("book with mismatched title is blocked even with official cover and link", () => {
  const value = { ...base, title: "Les vacances interdites",
    copy: { text: "TERRA : https://www.amazon.fr/dp/B0H4CN5MSH" } };
  const result = evaluate(value);
  assert.equal(result.status, "blocked");
});

test("missing or empty copy never erases provenance and always blocks", () => {
  const value = { ...base, copy: {}, provenance: { source: "publisher", seedId: "terra" } };
  const result = evaluate(value);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.provenance, value.provenance);
  assert.equal(result.editorialQuality.verifiedDestination, null);
});

test("verified Gerard seed accepts a technical iteration title but requires correct book URL", () => {
  const value = {
    ...base,
    seedId: "gerard-et-gerard",
    title: "☁️ Récolte serveur · Gérard & Gérard (itération 3)",
    copy: { text: "Deux Gérard. Un seul livre. Découvrir : https://www.amazon.fr/dp/B0H68811RL" },
  };
  const accepted = evaluate(value);
  assert.equal(accepted.status, "ready");
  assert.equal(accepted.editorialQuality.verifiedDestination, "https://www.amazon.fr/dp/B0H68811RL");
  const unrelated = evaluate({ ...value, copy: { text: "Deux Gérard. Un seul livre. https://www.amazon.fr/dp/B0H4CN5MSH" } });
  assert.equal(unrelated.status, "blocked");
});

test("verified TERRA seed rejects a link to another book", () => {
  const unrelated = evaluate({ ...base, seedId: "terra", copy: { text: "TERRA https://www.amazon.fr/dp/B0H68811RL" } });
  assert.equal(unrelated.status, "blocked");
});

test("TERRA can test a fresh mystery angle despite a technical iteration title", () => {
  const candidate = { ...base, seedId: "terra", title: "☁️ Récolte serveur · TERRA (itération 3)",
    copy: { text: "Version mystère : devinez ce que cache TERRA. Découvrir le livre : https://www.amazon.fr/dp/B0H4CN5MSH" } };
  const accepted = evaluate(candidate);
  assert.equal(accepted.status, "ready");
  assert.equal(accepted.editorialQuality.status, "complete");
  const unrelated = evaluate({ ...candidate, copy: { text: "Un autre roman : https://www.amazon.fr/dp/B0H4CN5MSH" } });
  assert.equal(unrelated.status, "ready", "the verified book URL can identify TERRA without naming it");
});

test("Gerard & Gerard may use a curiosity hook with its verified book link", () => {
  const value = { ...base, seedId: "gerard-et-gerard",
    title: "Apprentissages et angles · Gérard & Gérard — Brèves histoires d'une simulation oubliée",
    copy: { text: "Et si deux extraterrestres essayaient de comprendre pourquoi les humains courent sur des tapis qui ne vont nulle part ? Découvrir le livre : https://www.amazon.fr/dp/B0H68811RL" } };
  const result = evaluate(value);
  assert.equal(result.status, "ready");
  assert.equal(result.editorialQuality.status, "complete");
});
