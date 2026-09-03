import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadStore() {
  const store = new Map();
  const context = {
    console, Date, Intl, Math, Set, Map, JSON, String, Number, Array, Object, URL, Promise,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    dispatchEvent: () => true,
    setTimeout, clearTimeout,
  };
  context.globalThis = context;
  context.global = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("garden-domain.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-store.js", "utf8"), context);
  return context;
}

const seedOf = (context, id) => context.GardenStore.snapshot().seeds.find((seed) => seed.id === id);

/**
 * createSeed ne recopie que les champs qu'il connaît. knowledgeSlug n'en
 * faisait pas partie : le déclarer sur une graine (yael-parcel.js) était sans
 * effet, et gerard-local-harvester retombait sur l'id de la graine pour
 * interroger Publisher — un slug qui ne correspond à aucun paquet.
 */
test("une graine conserve le knowledgeSlug déclaré à la plantation", () => {
  const context = loadStore();
  context.GardenStore.registerParcel({ id: "project-yael-prospection", code: "PROJECT-YAEL", name: "Yael" });
  context.GardenStore.plantSeed({
    id: "yael-prospection",
    parcelId: "project-yael-prospection",
    title: "Yael · Préqualification de prospects",
    knowledgeSlug: "yael-prequalification-de-prospects",
  });

  assert.equal(seedOf(context, "yael-prospection").knowledgeSlug, "yael-prequalification-de-prospects");
});

/**
 * gerard-knowledge-garden-v3 pose ce champ via updateSeed() longtemps après la
 * plantation, et yael-parcel.js replante à chaque chargement de page : un
 * champ toujours présent, même vide, aurait écrasé le slug à chaque passage.
 */
test("replanter sans slug n'efface pas celui déjà enregistré", () => {
  const context = loadStore();
  context.GardenStore.registerParcel({ id: "parcel-1", code: "P1", name: "Parcelle" });
  context.GardenStore.plantSeed({ id: "seed-1", parcelId: "parcel-1", title: "Graine" });
  context.GardenStore.updateSeed("seed-1", { knowledgeSlug: "pack-decouvert-plus-tard" });

  context.GardenStore.plantSeed({ id: "seed-1", parcelId: "parcel-1", title: "Graine" });

  assert.equal(seedOf(context, "seed-1").knowledgeSlug, "pack-decouvert-plus-tard");
});

test("une graine sans slug n'en invente pas un", () => {
  const context = loadStore();
  context.GardenStore.registerParcel({ id: "parcel-1", code: "P1", name: "Parcelle" });
  context.GardenStore.plantSeed({ id: "seed-2", parcelId: "parcel-1", title: "Graine" });

  assert.equal("knowledgeSlug" in seedOf(context, "seed-2"), false);
});

/**
 * yael-parcel.js est la source de vérité de ce lien : si son slug diverge de
 * celui déclaré dans KNOWN_ALIASES côté Worker, le paquet redevient
 * introuvable sans que rien ne le signale.
 */
test("yael-parcel.js déclare bien le slug attendu par le Worker", () => {
  const source = fs.readFileSync("yael-parcel.js", "utf8");
  assert.match(source, /knowledgeSlug:\s*"yael-prequalification-de-prospects"/);
});
