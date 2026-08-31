import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext(initialState) {
  const store = new Map();
  if (initialState) store.set("poulpe-fiction:garden-domain:v1", JSON.stringify(initialState));
  const events = [];
  const context = {
    console, Date, Intl, Math, Set, Map, JSON, String, Number, Array, Object, URL, Promise,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    dispatchEvent: (event) => { events.push(event); return true; },
    setTimeout, clearTimeout,
  };
  context.globalThis = context;
  context.global = context;
  context.__events = events;
  context.__rawState = () => JSON.parse(store.get("poulpe-fiction:garden-domain:v1"));
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("garden-domain.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-store.js", "utf8"), context);
  return context;
}

function stateWith(harvestCount) {
  return {
    version: 2,
    parcels: [{ id: "parcel-1", code: "P1", name: "Parcelle 1" }],
    seeds: [{ id: "seed-1", parcelId: "parcel-1", title: "Seed 1", status: "planted" }],
    sprouts: [],
    harvests: Array.from({ length: harvestCount }, (_, index) => ({
      id: `harvest-${index}`,
      parcelId: "parcel-1",
      seedId: "seed-1",
      title: `Récolte ${index}`,
      createdAt: new Date(Date.now() - index * 1000).toISOString(),
      content: "contenu",
    })),
    operations: [],
    compost: [],
    activeParcelId: "parcel-1",
    activeSeedId: null,
    updatedAt: null,
  };
}

/**
 * Le clone profond de l'état complet coûtait ~24 ms pour 730 récoltes, à
 * chaque lecture — et snapshot() est appelé en rafale (toutes les 5 s par
 * gerard-autonomy, à chaque montage d'écran, une fois par écran abonné à
 * chaque « poulpe-garden-changed »).
 */
test("deux lectures consécutives ne reclonent pas l'état", () => {
  const context = createContext(stateWith(50));
  const first = context.GardenStore.snapshot();
  const second = context.GardenStore.snapshot();
  assert.equal(first, second, "snapshot() devrait renvoyer le clone déjà en cache");
});

test("une écriture invalide le cache : la lecture suivante voit la nouveauté", () => {
  const context = createContext(stateWith(2));
  const before = context.GardenStore.snapshot();
  assert.equal(before.harvests.length, 2);

  context.GardenStore.addHarvest({ id: "harvest-neuf", parcelId: "parcel-1", seedId: "seed-1", title: "Neuve" });

  const after = context.GardenStore.snapshot();
  assert.notEqual(after, before, "un nouvel objet doit être produit après une écriture");
  assert.ok(after.harvests.some((harvest) => harvest.id === "harvest-neuf"));
  // L'ancien clone reste tel qu'il était : personne ne se retrouve avec un
  // objet muté sous les pieds.
  assert.equal(before.harvests.length, 2);
});

test("persist() n'émet qu'un seul clone, partagé par l'événement et le retour", () => {
  const context = createContext(stateWith(2));
  context.__events.length = 0;
  const returned = context.GardenStore.persist();
  const changed = context.__events.filter((event) => event.type === "poulpe-garden-changed");
  assert.equal(changed.length, 1);
  assert.equal(changed[0].detail, returned);
  assert.equal(context.GardenStore.snapshot(), returned);
});

/**
 * Le cache suppose que personne ne modifie l'objet reçu. Aucun appelant ne le
 * fait aujourd'hui ; ce test verrouille la conséquence qui compte : même si
 * quelqu'un s'y risquait, l'état persisté resterait intact.
 */
test("écrire dans un snapshot n'atteint jamais l'état persisté", () => {
  const context = createContext(stateWith(1));
  const snapshot = context.GardenStore.snapshot();
  snapshot.harvests.push({ id: "intrus", parcelId: "parcel-1", seedId: "seed-1" });
  snapshot.parcels[0].name = "Renommée par erreur";

  context.GardenStore.addHarvest({ id: "harvest-legitime", parcelId: "parcel-1", seedId: "seed-1", title: "Légitime" });

  const persisted = context.__rawState();
  assert.ok(!persisted.harvests.some((harvest) => harvest.id === "intrus"));
  assert.equal(persisted.parcels[0].name, "Parcelle 1");
  assert.ok(persisted.harvests.some((harvest) => harvest.id === "harvest-legitime"));
});
