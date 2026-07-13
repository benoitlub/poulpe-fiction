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

function loadProductionPack(context) {
  vm.runInContext(fs.readFileSync("production-pack.js", "utf8"), context);
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

test("exposes produced harvest content and Canva URL", () => {
  const context = createContext();
  context.GardenStore = {
    snapshot: () => ({ parcels: [], seeds: [], sprouts: [], harvests: [], operations: [] })
  };
  context.AdventureReturnProcessor = {
    loadOutbox: () => [{
      id: "return-production",
      status: "ready",
      parcelId: "blacklace-ecosystem",
      missionId: "mission-production",
      createdAt: "2026-07-06T10:00:00.000Z",
      harvests: [
        { id: "harvest-landing", title: "Landing page TERRA", description: "Landing ready", artifactType: "landing-page", artifact: "Full landing text", createdAt: "2026-07-06T10:00:00.000Z", missionId: "mission-production", parcelId: "blacklace-ecosystem" },
        { id: "harvest-canva", title: "Canva TERRA", description: "Canva design", artifactType: "instagram-visual", artifact: { url: "https://canva.example/design" }, url: "https://canva.example/design", createdAt: "2026-07-06T11:00:00.000Z", missionId: "mission-production", parcelId: "blacklace-ecosystem" }
      ]
    }]
  };
  loadModules(context);
  const harvests = context.GardenDashboard.harvests(context.GardenPersistence.snapshot());
  assert.equal(harvests.find((harvest) => harvest.id === "harvest-landing").content.text, "Full landing text");
  assert.equal(harvests.find((harvest) => harvest.id === "harvest-canva").url, "https://canva.example/design");
});

test("uses live production diagnostics instead of stale pack connector status", () => {
  const context = createContext();
  vm.createContext(context);
  context.state = { step: "idle" };
  context.root = { querySelector: () => null };
  context.ProductionPlan = { updateFromProductionPack: () => null };
  context.TerraHarvestLoop = {
    latestTerraBundle: () => ({ harvests: [{ artifactType: "landing-page" }] }),
    landingHarvest: () => ({ id: "landing" }),
    visualHarvest: () => null
  };
  loadProductionPack(context);
  context.localStorage.setItem(context.ProductionPack.CONNECTION_KEY, JSON.stringify({
    status: "ready",
    payload: {
      canva: { connected: true },
      composio: { canvaConnected: true },
      elevenLabs: { connected: true },
      mistral: { available: true }
    }
  }));
  const artifact = { id: "social-visual", type: "social-visual", provider: "Canva", providerStatus: "not-configured" };
  assert.equal(context.ProductionPack.connectionStatus("Canva", context.ProductionPack.loadConnections()), "Connecté");
  assert.equal(context.ProductionPack.artifactStatus(artifact, context.ProductionPack.loadConnections()), "authorization-required");
});

test("replaces legacy production pack block on result render", () => {
  const context = createContext();
  let panelHtml = `<section class="production-pack">ancien</section>`;
  const panel = {
    querySelector: (selector) => {
      if (selector !== ".production-pack" || !panelHtml.includes("production-pack")) return null;
      return {
        set outerHTML(value) { panelHtml = value; }
      };
    },
    insertAdjacentHTML: (_position, html) => { panelHtml += html; }
  };
  context.root = {
    querySelector: (selector) => selector === ".panel" ? panel : null
  };
  context.state = { step: "result" };
  context.fetch = async () => ({ ok: true, json: async () => ({}) });
  context.document.querySelectorAll = () => [];
  context.document.querySelector = () => null;
  context.BlacklaceParcel = {
    activeSeed: () => ({ parcelId: "terra", seedId: "terra", seedTitle: "TERRA" })
  };
  context.AdventureDraft = {
    load: () => ({ id: "draft-terra" })
  };
  context.AdventureReturnProcessor = {
    latestForDraft: () => ({
      id: "return-terra",
      status: "ready",
      parcelId: "blacklace-ecosystem",
      missionId: "mission-terra",
      harvests: [{ id: "harvest-text", title: "TERRA", description: "Landing", artifactType: "text", artifact: "Landing text" }]
    })
  };
  context.ProductionPlan = { current: () => null, updateFromProductionPack: () => null };
  context.TerraHarvestLoop = {
    latestTerraBundle: () => null,
    landingHarvest: () => null,
    visualHarvest: () => null
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("production-pack.js", "utf8"), context);
  context.localStorage.setItem(context.ProductionPack.CONNECTION_KEY, JSON.stringify({
    status: "ready",
    payload: { canva: { connected: true }, elevenLabs: { connected: true }, mistral: { available: true } }
  }));

  context.render();
  context.render();

  assert.equal(panelHtml.includes("ancien"), false);
  assert.match(panelHtml, /Produire maintenant/);
  assert.match(panelHtml, /data-production-now/);
  assert.match(panelHtml, /data-open-all-harvests/);
  assert.match(panelHtml, /data-refresh-production-connections/);
  assert.equal((panelHtml.match(/class="production-pack"/g) || []).length, 1);
});
