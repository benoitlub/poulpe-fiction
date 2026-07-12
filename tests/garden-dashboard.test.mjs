import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext() {
  const store = new Map();
  const root = {
    insertAdjacentHTML() {},
  };
  const context = {
    console,
    Date,
    Intl,
    Math,
    Set,
    JSON,
    String,
    Number,
    Array,
    Object,
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    document: {
      getElementById: (id) => id === "root" ? root : null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    render() {},
  };
  context.globalThis = context;
  context.global = context;
  return context;
}

function loadModules(context) {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("garden-persistence.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-dashboard.js", "utf8"), context);
  return context;
}

function fixtureContext() {
  const context = createContext();
  context.GardenStore = {
    snapshot: () => ({
      parcels: [{ id: "terra", code: "P-1", name: "TERRA", mission: "Vendre TERRA", priorities: ["campagne"] }],
      seeds: [{ id: "seed-terra", parcelId: "terra", title: "Landing TERRA", objective: "Préparer la page", firstHarvest: "Landing page", source: "test", createdAt: "2026-07-01T10:00:00.000Z" }],
      sprouts: [],
      harvests: [{ id: "harvest-1", parcelId: "terra", seedId: "seed-terra", operationId: "mission-1", title: "Landing page TERRA", preview: "Page prête", status: "ready", createdAt: "2026-07-02T10:00:00.000Z" }],
      operations: [
        { id: "mission-1", parcelId: "terra", seedId: "seed-terra", intent: "prepare-harvest", status: "running", activity: "Travail en cours", createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:30:00.000Z" },
        { id: "mission-2", parcelId: "terra", seedId: "seed-terra", intent: "blocked-work", status: "blocked", activity: "Besoin d'autorisation", obstacle: { message: "Validation humaine requise" }, createdAt: "2026-07-03T12:00:00.000Z", updatedAt: "2026-07-03T12:30:00.000Z" }
      ]
    })
  };
  context.BlacklaceParcel = {
    activeSeed: () => ({ parcelId: "terra", seedId: "seed-terra", seedTitle: "Landing TERRA", firstHarvest: "Landing page" })
  };
  context.AdventureDraft = {
    load: () => ({
      id: "adventure-1",
      status: "validated",
      curiosity: { id: "seed-terra", title: "Landing TERRA" },
      objective: "Préparer une landing page",
      bag: ["Seed TERRA"],
      picnic: ["Publisher"],
      grafts: ["Mistral"],
      limits: ["Validation humaine"],
      createdAt: "2026-07-04T10:00:00.000Z"
    })
  };
  context.AdventureReturnProcessor = {
    loadOutbox: () => [{
      id: "return-1",
      status: "ready",
      parcelId: "terra",
      missionId: "mission-1",
      createdAt: "2026-07-05T10:00:00.000Z",
      harvests: [{ id: "return-harvest-1", title: "Récolte TERRA", description: "Résultat utile", artifactType: "text", createdAt: "2026-07-05T10:00:00.000Z", missionId: "mission-1", parcelId: "terra" }],
      seeds: [{ id: "seed-next", title: "Suite", description: "Nouvelle piste", createdAt: "2026-07-05T11:00:00.000Z" }],
      questions: [{ id: "question-1", title: "Valider ?", context: "Choisir le canal", createdAt: "2026-07-05T12:00:00.000Z" }],
      learnings: [{ id: "learning-1", summary: "TERRA marche", details: "Le ton est clair", createdAt: "2026-07-05T13:00:00.000Z" }]
    }]
  };
  context.ProductionPack = {
    load: () => [{ id: "production-1", returnId: "return-1", parcelId: "terra", seedId: "seed-terra", title: "Pack TERRA", createdAt: "2026-07-06T10:00:00.000Z", artifacts: [{ status: "ready" }], publications: [] }]
  };
  return loadModules(context);
}

test("persists dashboard view selection", () => {
  const context = fixtureContext();
  context.GardenPersistence.selectView("missions");
  assert.equal(context.GardenPersistence.dashboardState().selectedView, "missions");
});

test("sorts missions by priority before date", () => {
  const context = fixtureContext();
  const missions = context.GardenDashboard.missions(context.GardenPersistence.snapshot());
  assert.equal(missions[0].id, "mission-2");
  assert.equal(missions[0].priority, "urgent");
});

test("builds chronological notebook with mission, harvest, question and learning", () => {
  const context = fixtureContext();
  const entries = context.GardenDashboard.notebookEntries(context.GardenPersistence.snapshot(), "terra");
  const types = new Set(entries.map((entry) => entry.type));
  assert.ok(types.has("Mission créée"));
  assert.ok(types.has("Récolte"));
  assert.ok(types.has("Question"));
  assert.ok(types.has("Apprentissage"));
});

test("keeps bag and harvest linked to a mission without duplicates", () => {
  const context = fixtureContext();
  const data = context.GardenPersistence.snapshot();
  const missions = context.GardenDashboard.missions(data);
  const harvests = context.GardenDashboard.harvests(data);
  assert.ok(missions.some((mission) => mission.id === "adventure-1" && mission.bag));
  assert.ok(harvests.some((harvest) => harvest.missionId === "mission-1"));
  assert.equal(new Set(harvests.map((harvest) => harvest.id)).size, harvests.length);
});

test("exposes blocked operations as user-facing issues", () => {
  const context = fixtureContext();
  const issues = context.GardenDashboard.allIssues(context.GardenPersistence.snapshot());
  assert.equal(issues[0].type, "Mission bloquée");
  assert.equal(issues[0].cause, "Validation humaine requise");
});

test("mobile navigation styles are present", () => {
  const css = fs.readFileSync("style.css", "utf8");
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /\.garden-nav-item/);
  assert.match(css, /width:\s*100%/);
});
