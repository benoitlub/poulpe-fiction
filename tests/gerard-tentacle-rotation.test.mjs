import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const STATE_KEY = "poulpe-fiction:gerard-autonomy:v2";

/**
 * gerard-autonomy.js démarre tout seul au chargement (start(), setInterval,
 * écouteurs). On lui fournit le strict nécessaire et aucun AdventureDraft, de
 * sorte que le cycle automatique ne fasse rien : seule la règle de sélection
 * nous intéresse ici.
 */
function loadAutonomy(tentacles) {
  const store = new Map([[STATE_KEY, JSON.stringify({ enabled: false, tentacles })]]);
  const context = {
    console, Date, Intl, Math, Set, Map, JSON, String, Number, Array, Object, URL, Promise,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    document: { addEventListener() {}, visibilityState: "hidden" },
    addEventListener() {},
    dispatchEvent: () => true,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  };
  context.globalThis = context;
  context.global = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("gerard-autonomy.js", "utf8"), context);
  return context;
}

const draft = (seedId) => ({ id: `draft-${seedId}`, status: "validated", curiosity: { id: seedId } });

// selectDueDrafts renvoie un tableau créé dans le contexte vm : on le ramène
// dans le realm hôte, sinon deepEqual bute sur des prototypes différents.
function selectedIds(context, drafts) {
  return Array.from(context.GerardAutonomy.selectDueDrafts(drafts), (item) => item.curiosity.id);
}

/**
 * Le symptôme réel : « yael-prospection » a été insérée après huit autres
 * projets actifs et n'avait plus été itérée depuis le 11 août. slice() sur
 * l'ordre d'insertion la laissait dehors à chaque cycle, indéfiniment.
 */
test("un projet jamais tenté passe devant, même inséré en dernier", () => {
  const recent = new Date().toISOString();
  const tentacles = {};
  const drafts = [];
  for (let index = 0; index < 8; index += 1) {
    const seedId = `projet-${index}`;
    tentacles[seedId] = { lastAttemptAt: recent, lastStatus: "harvest-ready", iterations: 3 };
    drafts.push(draft(seedId));
  }
  drafts.push(draft("yael-prospection"));

  const context = loadAutonomy(tentacles);
  const selected = selectedIds(context, drafts);

  assert.equal(selected.length, context.GerardAutonomy.MAX_CONCURRENT_TENTACLES);
  assert.equal(selected[0], "yael-prospection", "le projet jamais tenté est le plus en retard");
});

test("le plus anciennement tenté passe avant le plus récemment tenté", () => {
  const tentacles = {
    "vieux-projet": { lastAttemptAt: "2026-08-11T09:00:00.000Z" },
    "projet-recent": { lastAttemptAt: new Date().toISOString() },
  };
  const context = loadAutonomy(tentacles);
  assert.deepEqual(selectedIds(context, [draft("projet-recent"), draft("vieux-projet")]), ["vieux-projet", "projet-recent"]);
});

/**
 * La rotation doit tenir dans le temps : sur plusieurs cycles, tout projet
 * actif doit finir par être servi. C'est exactement ce que l'ancien slice()
 * sur l'ordre d'insertion ne garantissait pas.
 */
test("sur plusieurs cycles, aucun projet actif ne reste sur le banc", () => {
  const total = 12;
  const tentacles = {};
  const drafts = Array.from({ length: total }, (_, index) => draft(`projet-${index}`));
  const served = new Set();

  for (let cycle = 0; cycle < 4; cycle += 1) {
    // Un cycle relit l'état persisté : on recharge le module pour que la
    // sélection voie les lastAttemptAt écrits au cycle précédent.
    for (const seedId of selectedIds(loadAutonomy(tentacles), drafts)) {
      served.add(seedId);
      // Ce qu'advanceOne() écrit lorsqu'une itération démarre réellement.
      tentacles[seedId] = { lastAttemptAt: new Date(Date.now() + cycle * 60_000).toISOString() };
    }
  }

  assert.equal(served.size, total, `attendu ${total} projets servis, obtenu ${served.size}`);
});

test("un projet qui vient d'itérer repart en fin de file", () => {
  const tentacles = { a: { lastAttemptAt: "2026-08-11T09:00:00.000Z" }, b: { lastAttemptAt: "2026-08-12T09:00:00.000Z" } };
  assert.equal(selectedIds(loadAutonomy(tentacles), [draft("a"), draft("b")])[0], "a");

  tentacles.a = { lastAttemptAt: new Date().toISOString() };
  assert.equal(selectedIds(loadAutonomy(tentacles), [draft("a"), draft("b")])[0], "b");
});

test("trier n'inscrit pas de tentacule pour un projet jamais tenté", () => {
  const context = loadAutonomy({});
  context.GerardAutonomy.selectDueDrafts([draft("yael-prospection"), draft("autre")]);
  assert.deepEqual(Object.keys(context.GerardAutonomy.snapshot().tentacles), []);
});
