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
    URL,
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
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    AbortController,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    setTimeout,
    clearTimeout,
    dispatchEvent: () => true,
    render() {},
  };
  context.globalThis = context;
  context.global = context;
  return context;
}

function loadModules(context) {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("runtime-config.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-persistence.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-dashboard.js", "utf8"), context);
  return context;
}

function loadRealGardenModules(context = createContext()) {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("runtime-config.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-domain.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-store.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-persistence.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("garden-dashboard.js", "utf8"), context);
  return context;
}

function loadRuntimeConfig(context = createContext()) {
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("runtime-config.js", "utf8"), context);
  return context;
}

test("sanitizes local URLs to Render URLs in production", () => {
  const context = loadRuntimeConfig();
  const sanitize = context.PoulpeRuntimeConfig.sanitizeServiceUrl;
  assert.equal(sanitize("http://localhost:5173", "https://octopus-engine.onrender.com", "production"), "https://octopus-engine.onrender.com");
  assert.equal(sanitize("http://127.0.0.1:3000", "https://blacklace-publisher-api.onrender.com", "production"), "https://blacklace-publisher-api.onrender.com");
  assert.equal(sanitize("http://0.0.0.0:3000", "https://blacklace-publisher.onrender.com", "production"), "https://blacklace-publisher.onrender.com");
  assert.equal(sanitize("http://host.docker.internal:3000", "https://blacklace-publisher.onrender.com", "production"), "https://blacklace-publisher.onrender.com");
});

test("allows localhost in development only", () => {
  const context = loadRuntimeConfig();
  const sanitize = context.PoulpeRuntimeConfig.sanitizeServiceUrl;
  assert.equal(sanitize("http://localhost:5173", "https://octopus-engine.onrender.com", "development"), "http://localhost:5173");
});

test("removes stale API localStorage overrides without clearing Garden data", () => {
  const context = createContext();
  context.localStorage.setItem("PUBLISHER_API_URL", "http://localhost:3000");
  context.localStorage.setItem("OCTOPUS_API_URL", "http://127.0.0.1:3001");
  context.localStorage.setItem("API_URL", "http://0.0.0.0:3002");
  context.localStorage.setItem("poulpe-fiction:garden-runtime-cache:v1", "{\"status\":\"idle\"}");
  loadRuntimeConfig(context);
  assert.equal(context.localStorage.getItem("PUBLISHER_API_URL"), null);
  assert.equal(context.localStorage.getItem("OCTOPUS_API_URL"), null);
  assert.equal(context.localStorage.getItem("API_URL"), null);
  assert.equal(context.localStorage.getItem("poulpe-fiction:garden-runtime-cache:v1"), "{\"status\":\"idle\"}");
});

test("uses official Render URLs and loads runtime config before app scripts", () => {
  const context = loadRuntimeConfig();
  assert.equal(context.PoulpeRuntimeConfig.urls.octopusApi, "https://octopus-engine.onrender.com");
  assert.equal(context.PoulpeRuntimeConfig.urls.publisherApi, "https://blacklace-publisher-api.onrender.com");
  assert.equal(context.PoulpeRuntimeConfig.urls.publisherFrontend, "https://blacklace-publisher-web.onrender.com");
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(html.indexOf("./build-info.js") < html.indexOf("./runtime-config.js"));
  assert.ok(html.indexOf("./runtime-config.js") > -1);
  assert.ok(html.indexOf("./runtime-config.js") < html.indexOf("./app.js"));
});

test("does not link Poulpe users to the Publisher local-technique path", () => {
  const dashboard = fs.readFileSync("garden-dashboard.js", "utf8");
  assert.equal(dashboard.includes("/local-technique"), false);
});

test("keeps bag and departure actions owned by DepartureController", () => {
  const parcel = fs.readFileSync("blacklace-parcel.js", "utf8");
  const shell = fs.readFileSync("garden-shell.js", "utf8");
  const controller = fs.readFileSync("departure-controller.js", "utf8");
  assert.equal(parcel.includes("function authorizeDeparture"), false);
  assert.equal(parcel.includes("data-view-bag].forEach"), false);
  assert.equal(parcel.includes("data-authorize-departure].forEach"), false);
  assert.match(controller, /document\.addEventListener\("click"/);
  assert.match(controller, /stopImmediatePropagation\(\)/);
  assert.match(shell, /DepartureController\?\.depart/);
  assert.equal(shell.includes("AdventureLaunch?.launch"), false);
});

test("prepares the adventure bag locally without waiting for Publisher", () => {
  const parcel = fs.readFileSync("blacklace-parcel.js", "utf8");
  assert.match(parcel, /function prepareSeedAdventure\(seedId, options\)/);
  assert.equal(parcel.includes("async function prepareSeedAdventure"), false);
  assert.equal(parcel.includes("await loadToolPack(seed)"), false);
  assert.match(parcel, /localToolPack\(seed\)/);
});

test("removes duplicate Garden action wrapper from the page", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.equal(html.includes("garden-runtime-actions.js"), false);
  assert.equal(fs.existsSync("garden-runtime-actions.js"), false);
});

test("critical provider knowledge calls can use the shared timeout", () => {
  const runtime = fs.readFileSync("runtime-config.js", "utf8");
  const knowledge = fs.readFileSync("publisher-knowledge.js", "utf8");
  assert.match(runtime, /withTimeout,/);
  assert.match(knowledge, /PoulpeRuntimeConfig\?\.withTimeout/);
});

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
  assert.match(`${css}\n${fs.readFileSync("garden-dashboard.css", "utf8")}\n${fs.readFileSync("mobile-fix.css", "utf8")}`, /\.shell-nav/);
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

test("produces landing page through Publisher Production Engine and stores downloadable HTML", async () => {
  const context = createContext();
  const calls = [];
  context.AdventureDraft = { load: () => ({ id: "draft-terra" }) };
  context.AdventureReturnProcessor = {
    OUTBOX_KEY: "poulpe-fiction:adventure-return-outbox:v1",
    loadOutbox: () => JSON.parse(context.localStorage.getItem("poulpe-fiction:adventure-return-outbox:v1") || "[]")
  };
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        tool: "html-local",
        artifact: {
          id: "artifact-landing",
          title: "Landing page TERRA",
          type: "landing-page.html",
          content: "<main><h1>TERRA</h1></main>",
          mimeType: "text/html"
        },
        plan: { id: "plan-landing", steps: [{ producerId: "html-local" }] }
      })
    };
  };
  loadRuntimeConfig(context);
  vm.runInContext(fs.readFileSync("terra-harvest-loop.js", "utf8"), context);

  const bundle = await context.TerraHarvestLoop.produceNow();
  const landing = context.TerraHarvestLoop.landingHarvest(bundle);

  assert.equal(calls[0].url, "https://blacklace-publisher-api.onrender.com/api/production/execute");
  assert.match(calls[0].options.body, /html-local/);
  assert.equal(landing.artifactType, "landing-page");
  assert.equal(landing.content.text, "<main><h1>TERRA</h1></main>");
  assert.match(landing.downloadUrl, /^data:text\/html/);
  assert.equal(landing.payload.plan.id, "plan-landing");
});

test("parcel notebook exposes downloadable landing harvests", () => {
  const context = createContext();
  let html = "";
  const root = { insertAdjacentHTML: (_position, value) => { html = value; } };
  context.document.getElementById = (id) => id === "root" ? root : null;
  context.document.querySelector = () => null;
  context.GardenStore = {
    snapshot: () => ({
      parcels: [{ id: "terra", code: "P-1", name: "TERRA", mission: "Vendre TERRA", priorities: ["campagne"] }],
      seeds: [],
      sprouts: [],
      operations: [],
      harvests: [{
        id: "harvest-html",
        parcelId: "terra",
        seedId: "terra",
        operationId: "mission-html",
        title: "Landing page TERRA",
        preview: "HTML pret",
        content: { text: "<main>TERRA</main>" },
        downloadUrl: "data:text/html;charset=utf-8,%3Cmain%3ETERRA%3C%2Fmain%3E",
        type: "landing-page",
        status: "ready",
        createdAt: "2026-07-15T10:00:00.000Z"
      }]
    })
  };
  context.localStorage.setItem("poulpe-fiction:garden-dashboard:v1", JSON.stringify({ selectedView: "parcels", selectedParcelId: "terra" }));

  loadModules(context);

  assert.match(html, /Récoltes de la parcelle/);
  assert.match(html, /Landing page TERRA/);
  assert.match(html, /Télécharger HTML/);
  assert.match(html, /download="landing-page-terra\.html"/);
});

test("extracts clean harvest text from supported payloads", () => {
  const context = fixtureContext();
  const extract = context.GardenDashboard.extractHarvestText;
  assert.equal(extract({ text: "Ligne 1\\nLigne 2" }), "Ligne 1\nLigne 2");
  assert.equal(extract({ content: { text: "Texte imbriqué" } }), "Texte imbriqué");
  assert.equal(extract({ payload: { text: "Texte payload" } }), "Texte payload");
  assert.equal(extract({ markdown: "# Titre\n- point" }), "# Titre\n- point");
  assert.equal(extract(JSON.stringify({ text: "Texte JSON\\npropre" })), "Texte JSON\npropre");
  assert.equal(extract({ content: { html: "<p>Non</p>" } }), "");
  assert.notEqual(extract({ content: { html: "<p>Non</p>" } }), "[object Object]");
});

test("renders object harvest payloads without object wrappers", () => {
  const context = createContext();
  context.GardenStore = {
    snapshot: () => ({ parcels: [], seeds: [], sprouts: [], harvests: [], operations: [] })
  };
  context.AdventureReturnProcessor = {
    loadOutbox: () => [{
      id: "return-object",
      status: "ready",
      parcelId: "terra",
      missionId: "mission-object",
      createdAt: "2026-07-06T10:00:00.000Z",
      harvests: [
        { id: "harvest-object", title: "Objet", description: "Résumé", artifactType: "text", artifact: { text: "Texte humain" }, createdAt: "2026-07-06T10:00:00.000Z" },
        { id: "harvest-json", title: "JSON", description: "Résumé", artifactType: "text", artifact: "{\"text\":\"Texte JSON\\\\nligne 2\"}", createdAt: "2026-07-06T11:00:00.000Z" },
        { id: "harvest-payload", title: "Payload", description: "Résumé", artifactType: "text", payload: { text: "Texte payload" }, createdAt: "2026-07-06T12:00:00.000Z" }
      ]
    }]
  };
  loadModules(context);
  const harvests = context.GardenDashboard.harvests(context.GardenPersistence.snapshot());
  assert.equal(harvests.find((harvest) => harvest.id === "harvest-object").content.text, "Texte humain");
  assert.equal(harvests.find((harvest) => harvest.id === "harvest-json").content.text, "Texte JSON\nligne 2");
  assert.equal(harvests.find((harvest) => harvest.id === "harvest-payload").content.text, "Texte payload");
  assert.equal(harvests.some((harvest) => harvest.content.text === "[object Object]"), false);
});

test("examines harvests inside the page instead of opening a blank popup", () => {
  const context = fixtureContext();
  let inserted = "";
  let opened = false;
  const panel = {
    querySelector: () => null,
    remove: () => { inserted = ""; }
  };
  const root = {
    insertAdjacentHTML: (_position, html) => { inserted += html; },
    querySelector: (selector) => selector === ".harvest-detail-panel" && inserted ? panel : null
  };
  context.open = () => { opened = true; };
  context.document.querySelector = (selector) => selector === ".garden-dashboard" ? root : null;
  context.document.getElementById = () => root;

  context.GardenDashboard.openHarvestDetail({ id: "h1", title: "Récolte", content: { text: "# Titre\n\n- **Point fort**\n- Suite" } });

  assert.equal(opened, false);
  assert.match(inserted, /harvest-detail-panel/);
  assert.match(inserted, /<h2>Titre<\/h2>/);
  assert.match(inserted, /<li><strong>Point fort<\/strong><\/li>/);
  assert.doesNotMatch(inserted, /\\n/);
  assert.doesNotMatch(inserted, /\{"text":/);
  assert.match(inserted, /Fermer/);
  assert.match(inserted, /Copier/);
});

test("accepts a harvest and persists the accepted status after reload", () => {
  const context = loadRealGardenModules();
  context.GardenPersistence.acceptHarvest("harvest-accepted");
  const reloaded = createContext();
  reloaded.localStorage = context.localStorage;
  loadRealGardenModules(reloaded);
  assert.equal(reloaded.GardenPersistence.harvestState().accepted["harvest-accepted"].status, "accepted");
});

test("accepting a return harvest moves it into GardenStore", () => {
  const context = loadRealGardenModules();
  context.GardenPersistence.acceptHarvest({
    id: "harvest-moved",
    parcelId: "terra",
    seedId: "seed-terra",
    missionId: "mission-moved",
    title: "Récolte déplacée",
    preview: "Texte propre",
    content: { text: "Texte propre" },
    date: "2026-07-06T10:00:00.000Z"
  });
  const stored = context.GardenStore.snapshot().harvests.find((item) => item.id === "harvest-moved");
  assert.equal(stored.title, "Récolte déplacée");
  assert.equal(stored.preview, "Texte propre");
  assert.equal(stored.content.text, "Texte propre");
  assert.equal(stored.status, "accepted");
});

test("accepting a harvest closes the active bag and completes the mission in GardenStore", () => {
  const context = createContext();
  const activeKey = "poulpe-fiction:blacklace-active-seed:v1";
  let draftCleared = false;
  context.BlacklaceParcel = {
    ACTIVE_SEED_KEY: activeKey,
    activeSeed: () => ({ parcelId: "terra", seedId: "seed-terra" })
  };
  context.AdventureDraft = {
    save: (value) => {
      if (value === null) draftCleared = true;
      return value;
    }
  };
  loadRealGardenModules(context);
  context.GardenStore.registerParcel({ id: "terra", name: "TERRA" });
  context.GardenStore.plantSeed({ id: "seed-terra", parcelId: "terra", title: "TERRA", content: "Seed" });
  context.GardenStore.activateSeed("terra", "seed-terra");
  context.localStorage.setItem(activeKey, JSON.stringify({ parcelId: "terra", seedId: "seed-terra" }));

  context.GardenPersistence.acceptHarvest({
    id: "harvest-cycle",
    parcelId: "terra",
    seedId: "seed-terra",
    missionId: "mission-cycle",
    title: "Récolte cycle",
    preview: "Cycle terminé",
    content: { text: "Cycle terminé" },
    date: "2026-07-06T10:00:00.000Z"
  });

  const state = context.GardenStore.snapshot();
  assert.equal(draftCleared, true);
  assert.equal(context.localStorage.getItem(activeKey), null);
  assert.equal(state.activeSeedId, null);
  assert.equal(state.harvests.some((item) => item.id === "harvest-cycle"), true);
  assert.equal(state.operations.find((item) => item.id === "mission-cycle").status, "ready");
});

test("accepting a landing harvest notifies Publisher and unlocks Canva authorization state", () => {
  const context = createContext();
  const calls = [];
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  context.TerraHarvestLoop = { STATUS_KEY: "terra-status" };
  loadRealGardenModules(context);
  context.PoulpeRuntimeConfig.urls.publisherApi = "https://publisher.example";
  context.GardenStore.registerParcel({ id: "terra", name: "TERRA" });
  context.GardenStore.plantSeed({ id: "seed-terra", parcelId: "terra", title: "TERRA", content: "Seed" });

  context.GardenPersistence.acceptHarvest({
    id: "harvest-landing-cycle",
    parcelId: "terra",
    seedId: "seed-terra",
    missionId: "mission-landing-cycle",
    title: "Landing page TERRA",
    type: "landing-page",
    preview: "Landing prête",
    content: { text: "Landing prête" },
    date: "2026-07-06T10:00:00.000Z"
  });

  const status = JSON.parse(context.localStorage.getItem("terra-status"));
  assert.equal(status.status, "waiting-authorization");
  assert.equal(status.prerequisiteHarvestId, "harvest-landing-cycle");
  assert.equal(calls[0].url, "https://publisher.example/api/production/available");
  assert.match(calls[0].options.body, /harvest-landing-cycle/);
});

test("requesting a harvest improvement creates a linked seed without starting departure", () => {
  const context = loadRealGardenModules();
  let departureStarted = false;
  context.AdventureLaunch = { launch: () => { departureStarted = true; } };
  const seed = context.GardenPersistence.requestHarvestImprovement({
    harvestId: "harvest-1",
    missionId: "mission-1",
    parcelId: "terra",
    title: "Landing page",
    content: "Rends le ton plus direct."
  });
  const stored = context.GardenStore.snapshot().seeds.find((item) => item.id === seed.id);
  assert.equal(stored.title, "Amélioration · Landing page");
  assert.equal(stored.content, "Rends le ton plus direct.");
  assert.equal(stored.parentHarvestId, "harvest-1");
  assert.equal(stored.parentMissionId, "mission-1");
  assert.equal(departureStarted, false);
});

test("syncs completed return missions into GardenStore operations", () => {
  const context = loadRealGardenModules();
  context.AdventureReturnProcessor = {
    loadOutbox: () => [{
      id: "return-mission",
      status: "ready",
      parcelId: "terra",
      missionId: "mission-return",
      createdAt: "2026-07-06T10:00:00.000Z",
      harvests: [{ id: "harvest-return", title: "Récolte", description: "Texte", artifactType: "text" }]
    }]
  };
  context.GardenPersistence.snapshot();
  const operation = context.GardenStore.snapshot().operations.find((item) => item.id === "mission-return");
  assert.equal(operation.status, "ready");
  assert.equal(operation.activity, "Récolte");
});

test("harvest cards keep Garden actions visible without new action owners", () => {
  const dashboard = fs.readFileSync("garden-dashboard.js", "utf8");
  assert.match(dashboard, /Nouvelle rÃ©colte|Nouvelle récolte/);
  assert.match(dashboard, /Examiner/);
  assert.match(dashboard, /Accepter/);
  assert.match(dashboard, /Demander une amÃ©lioration|Demander une amélioration/);
  assert.match(dashboard, /data-open-harvest/);
  assert.equal(dashboard.includes("addEventListener"), false);
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

test("shows connected Canva as idle when no Canva operation exists", () => {
  const context = createContext();
  vm.createContext(context);
  context.state = { step: "idle" };
  context.root = { querySelector: () => null };
  context.GardenStore = { snapshot: () => ({ operations: [] }) };
  context.ProductionPlan = { updateFromProductionPack: () => null };
  context.TerraHarvestLoop = {
    latestTerraBundle: () => ({ harvests: [{ artifactType: "landing-page" }] }),
    landingHarvest: () => ({ id: "landing" }),
    visualHarvest: () => null
  };
  loadProductionPack(context);
  context.localStorage.setItem(context.ProductionPack.CONNECTION_KEY, JSON.stringify({
    status: "ready",
    payload: { canva: { connected: true }, composio: { canvaConnected: true } }
  }));
  const pack = {
    id: "pack-terra",
    title: "Pack TERRA",
    seedId: "seed-terra",
    sourceManifest: {},
    artifacts: [{ id: "social", type: "social-visual", label: "Visuel Instagram", provider: "Canva", dependencies: ["landing-page"] }],
    publications: []
  };
  const html = context.ProductionPack.render(pack);
  assert.match(html, /Canva est connect/);
  assert.match(html, /Aucun travail Canva n'est actuellement en cours/);
});

test("shows real Canva operation status when one exists", () => {
  const context = createContext();
  vm.createContext(context);
  context.state = { step: "idle" };
  context.root = { querySelector: () => null };
  context.GardenStore = { snapshot: () => ({ operations: [{ id: "canva-1", intent: "canva-design", status: "running", activity: "Création Canva" }] }) };
  context.ProductionPlan = { updateFromProductionPack: () => null };
  context.TerraHarvestLoop = {
    latestTerraBundle: () => ({ harvests: [{ artifactType: "landing-page" }] }),
    landingHarvest: () => ({ id: "landing" }),
    visualHarvest: () => null
  };
  loadProductionPack(context);
  context.localStorage.setItem(context.ProductionPack.CONNECTION_KEY, JSON.stringify({
    status: "ready",
    payload: { canva: { connected: true }, composio: { canvaConnected: true } }
  }));
  const pack = {
    id: "pack-terra",
    title: "Pack TERRA",
    seedId: "seed-terra",
    sourceManifest: {},
    artifacts: [{ id: "social", type: "social-visual", label: "Visuel Instagram", provider: "Canva", dependencies: ["landing-page"] }],
    publications: []
  };
  const html = context.ProductionPack.render(pack);
  assert.match(html, /Canva/);
  assert.match(html, /running/);
  assert.match(html, /CrÃ©ation Canva|Création Canva/);
});

test("return presentation changes add no timers, global listeners or mutation observers", () => {
  const changed = ["garden-dashboard.js", "garden-persistence.js", "garden-store.js", "production-pack.js"]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.equal(changed.includes("MutationObserver"), false);
  assert.equal(changed.includes("setInterval"), false);
  assert.equal(changed.includes("addEventListener"), false);
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
