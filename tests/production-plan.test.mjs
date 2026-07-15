import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext() {
  const store = new Map();
  const context = {
    console,
    Date,
    JSON,
    String,
    Array,
    Object,
    Set,
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    },
    document: { querySelectorAll: () => [] },
    setTimeout,
    render() {},
    BlacklaceParcel: {
      PARCEL_ID: "blacklace",
      parcel: {
        seeds: [{
          id: "seed-420",
          type: "game",
          title: "420 Dice",
          objective: "Preparer la production 420 Dice",
          firstHarvest: "Fiche produit",
        }],
      },
      activeSeed: () => ({ seedId: "seed-420" }),
      loadToolPack: async () => ({ source: "test", tools: [] }),
    },
    ConnectionBroker: {
      planAll: async () => [],
      connectionLabel: (status) => ({ connected: "Connecte", "not-configured": "Non connecte" })[status] || status,
      routeLabel: (route) => ({ composio: "via Composio", manual: "manuel", internal: "interne" })[route] || route,
      creditLabel: (status) => status,
    },
  };
  context.globalThis = context;
  context.global = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("production-plan.js", "utf8"), context);
  return context;
}

function basePlan() {
  return {
    id: "production-plan-seed-420",
    seedId: "seed-420",
    seedTitle: "420 Dice",
    goal: "Preparer la production 420 Dice",
    expectedHarvest: "Fiche produit",
    brokerStatus: "planned",
    status: "planned",
    steps: [
      { id: "product-page", type: "landing-page", label: "Fiche produit", provider: "Poulpe Fiction HTML", providerStatus: "available", connectionRoute: "internal", authorization: "granted", creditStatus: "not-applicable", executable: true, status: "ready", dependsOn: [] },
      { id: "demo-visual", type: "social-visual", label: "Visuel de demonstration", provider: "Canva", providerStatus: "connected", connectionRoute: "composio", authorization: "granted", creditStatus: "available", executable: true, status: "blocked", dependsOn: ["product-page"] },
      { id: "demo-video", type: "vertical-video", label: "Video de demonstration", provider: "Kling", providerStatus: "not-configured", connectionRoute: "manual", authorization: "required", creditStatus: "unknown", executable: false, status: "blocked", dependsOn: ["demo-visual"] },
    ],
  };
}

test("connected future steps wait for prerequisites without authorization-required copy", () => {
  const context = createContext();
  const plan = basePlan();
  plan.steps[0].status = "ready-to-produce";
  const html = context.ProductionPlan.render(plan);
  assert.match(html, /Canva connecte - attend le prerequis/);
  assert.equal(html.includes("Autorisation requise"), false);
  assert.equal(html.includes("Connexions requises"), false);
});

test("future nonconnected steps do not block the current production state", () => {
  const context = createContext();
  const plan = basePlan();
  plan.steps[0].status = "ready-to-produce";
  plan.steps[1].status = "blocked";
  plan.steps[2].status = "blocked";
  const html = context.ProductionPlan.render(plan);
  assert.match(html, /Production possible/);
  assert.equal(html.includes("Reglage necessaire</span>"), false);
});

test("technical provider details stay collapsed below the first level", () => {
  const context = createContext();
  const html = context.ProductionPlan.render(basePlan());
  const firstLevel = html.split("<details")[0];
  assert.equal(firstLevel.includes("Composio"), false);
  assert.equal(firstLevel.includes("available"), false);
  assert.match(html, /<summary>Details techniques<\/summary>/);
});

test("the plan exposes a single primary next action", () => {
  const context = createContext();
  const plan = basePlan();
  plan.steps[0].status = "ready-to-produce";
  const html = context.ProductionPlan.render(plan);
  const count = (html.match(/class="primary"/g) || []).length;
  assert.equal(count, 1);
});

test("refresh updates an existing plan with server-confirmed Canva state", async () => {
  const context = createContext();
  context.ConnectionBroker.planAll = async () => [
    {
      selected: {
        name: "Canva",
        connectionStatus: "connected",
        route: "composio",
        authorization: "granted",
        creditStatus: "available",
      },
      executable: true,
      alternatives: [],
      decisionMode: "server-confirmed",
    },
    {
      selected: {
        name: "Kling",
        connectionStatus: "not-configured",
        route: "manual",
        authorization: "required",
        creditStatus: "unknown",
      },
      executable: false,
      alternatives: [],
      decisionMode: "unavailable",
    },
    {
      selected: {
        name: "Publisher business-growth",
        connectionStatus: "connected",
        route: "manual",
        authorization: "granted",
        creditStatus: "available",
      },
      executable: true,
      alternatives: [],
      decisionMode: "server-confirmed",
    },
    {
      selected: {
        name: "Publisher",
        connectionStatus: "connected",
        route: "manual",
        authorization: "granted",
        creditStatus: "available",
      },
      executable: true,
      alternatives: [],
      decisionMode: "server-confirmed",
    },
  ];

  await context.ProductionPlan.refreshFromPublisher();
  const plan = context.ProductionPlan.load()[0];
  const canva = plan.steps.find((step) => step.id === "demo-visual");
  assert.equal(canva.providerStatus, "connected");
  assert.equal(canva.authorization, "granted");
  assert.equal(canva.status, "blocked");
});
