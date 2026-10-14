import test from "node:test";
import assert from "node:assert/strict";
import { compostHarvests, isSimulatedHarvest, isCrossParcelYaebaliHarvest } from "../scripts/gerard-compost.mjs";

const now = "2026-10-14T18:00:00.000Z";
const fallback = "Contenu généré pour l'univers poulpe-fiction par Sofia. Mode mock actif — configurez AI_PROVIDER et AI_API_KEY pour une génération réelle.";
const make = (id, content, seedId = "seed-a", parcelId = "parcel-a", extras = {}) =>
  ({ harvestId: id, content, seedId, parcelId, state: "harvested", ...extras });

test("explicit Sofia fallback is composted without deleting content or metadata", () => {
  const original = make("mock-1", fallback, "seed-y", "private-client", { delivery: { recipient: "Client", mode: "propose-before-send" } });
  assert.equal(isSimulatedHarvest(original), true);
  const { harvests, report } = compostHarvests([original], { now });
  assert.equal(harvests.length, 1);
  assert.equal(harvests[0].state, "composted");
  assert.equal(harvests[0].content, fallback);
  assert.deepEqual(harvests[0].delivery, original.delivery);
  assert.equal(harvests[0].compost.reason, "simulated-provider-placeholder");
  assert.equal(harvests[0].compost.previousState, "harvested");
  assert.equal(harvests[0].compost.recoverable, true);
  assert.equal(report.newlyComposted, 1);
  assert.equal(report.safeguards.deleted, 0);
});

test("do not compost genuine text merely talking about a mock mode", () => {
  const real = make("article", "L'article critique le message « Mode mock actif » sans être une récolte simulée.");
  assert.equal(isSimulatedHarvest(real), false);
  assert.equal(compostHarvests([real], { now }).harvests[0].state, "harvested");
});

test("duplicate real content in one parcel and seed keeps the first canonical harvest", () => {
  const a = make("first", "Un texte pertinent qui mérite diffusion.");
  const b = make("second", "   un texte pertinent qui mérite diffusion.  ");
  const { harvests, report } = compostHarvests([a, b], { now });
  assert.equal(harvests[0].state, "harvested");
  assert.equal(harvests[1].state, "composted");
  assert.equal(harvests[1].compost.reason, "exact-content-duplicate");
  assert.equal(harvests[1].compost.canonicalHarvestId, "first");
  assert.equal(report.reasons.exactDuplicate, 1);
});

test("identical material for different clients or seeds is not automatically composted", () => {
  const a = make("a", "Texte partagé", "seed-a", "parcel-a");
  const b = make("b", "Texte partagé", "seed-b", "parcel-a");
  const c = make("c", "Texte partagé", "seed-a", "parcel-other");
  const { harvests, report } = compostHarvests([a, b, c], { now });
  assert.equal(report.newlyComposted, 0);
  assert.deepEqual(harvests, [a, b, c]);
});

test("run twice is idempotent and does not change compost timestamps or prior state", () => {
  const original = [make("mock", fallback), make("real", "Contenu à conserver"), make("duplicate", "Contenu à conserver")];
  const first = compostHarvests(original, { now });
  const second = compostHarvests(first.harvests, { now: "2026-10-15T10:00:00.000Z" });
  assert.equal(first.report.newlyComposted, 2);
  assert.equal(second.report.newlyComposted, 0);
  assert.equal(second.report.activeHarvests, 1);
  assert.deepEqual(second.harvests, first.harvests);
});

test("explicit provider mock flag is respected, archived entries remain untouched", () => {
  const flagged = make("flag", "Une description de fallback inattendue.", "a", "a", { isMock: true });
  const archived = make("archived", fallback, "a", "a", { state: "archived" });
  const { harvests } = compostHarvests([flagged, archived], { now });
  assert.equal(harvests[0].state, "composted");
  assert.equal(harvests[1].state, "archived");
});

test("Yaebali 420 Dice campaigns are composted but their original text is retained", () => {
  const bad = make("client-bad", "### Campagne Instagram (@pro.hbtd) – Reel 420 Dice Game Reboot\\nProspects via le jeu.", "yael-prospection", "project-yael-prospection",
    { state: "ready-to-offer", delivery: { recipient:"Yaébali", mode:"propose-before-send" } });
  const good = make("client-good", "Yael Bali accompagne les projets immobiliers à Guyancourt, proposer un formulaire opt-in.", "yael-prospection", "project-yael-prospection", { state:"ready-to-offer" });
  const other = make("game-real", bad.content, "420-dice", "poulpe-fiction");
  assert.equal(isCrossParcelYaebaliHarvest(bad), true);
  assert.equal(isCrossParcelYaebaliHarvest(good), false);
  assert.equal(isCrossParcelYaebaliHarvest(other), false);
  const first = compostHarvests([bad, good, other], { now });
  assert.equal(first.report.reasons.crossParcel, 1);
  assert.equal(first.harvests[0].state, "composted");
  assert.equal(first.harvests[0].compost.reason, "cross-parcel-420-dice-in-yaebali");
  assert.equal(first.harvests[0].compost.previousState, "ready-to-offer");
  assert.equal(first.harvests[0].content, bad.content);
  assert.deepEqual(first.harvests[0].delivery, bad.delivery);
  assert.equal(first.harvests[1].state, "ready-to-offer");
  assert.equal(first.harvests[2].state, "harvested");
  assert.equal(compostHarvests(first.harvests, { now }).report.newlyComposted, 0);
});

test("a warning mentioning another universe is not itself a client ad", () => {
  const warning = make("warning", "Ne pas diffuser 420 Dice sur la page de Yaébali; la prospection immobilière doit rester séparée.", "yael-prospection", "project-yael-prospection");
  assert.equal(isCrossParcelYaebaliHarvest(warning), false);
});
