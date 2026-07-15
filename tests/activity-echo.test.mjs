import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadActivityEcho() {
  const context = { console, Date, Math };
  context.globalThis = context;
  vm.createContext(context);
  const source = readFileSync(new URL("../activity-echo.js", import.meta.url), "utf8");
  vm.runInContext(source, context);
  return context.ActivityEcho;
}

test("ActivityEcho renders the calm Garden message when no real event is active", () => {
  const activityEcho = loadActivityEcho();
  const html = activityEcho.render([]);
  assert.match(html, /Le jardin est calme\. Gérard l’a décidé\./);
  assert.match(html, /data-status="calme"/);
});

test("ActivityEcho translates Garden sources into the five Lovable poles", () => {
  const activityEcho = loadActivityEcho();
  const events = activityEcho.collectEvents({
    activeSeed: { id: "terra", title: "TERRA", updatedAt: "2026-07-13T10:00:00.000Z" },
    runtimeState: { loading: true },
    runtimeRecord: {
      operationId: "operation-1",
      status: "running",
      activity: "Octopus prépare une tentative",
      updatedAt: "2026-07-13T10:03:00.000Z"
    },
    draft: {
      id: "draft-1",
      status: "prepared",
      objective: "Préparer une sortie",
      grafts: ["Lovable"],
      updatedAt: "2026-07-13T10:01:00.000Z"
    },
    returnBundles: [{
      id: "return-1",
      createdAt: "2026-07-13T10:04:00.000Z",
      harvests: [{ id: "harvest-1", title: "Landing page", createdAt: "2026-07-13T10:04:00.000Z" }],
      seeds: []
    }]
  });

  assert.deepEqual(new Set(events.map((event) => event.pole)), new Set(["radar", "observatoire", "publisher", "octopus", "garden"]));
});

test("ActivityEcho translates Garden sources into Lovable states", () => {
  const activityEcho = loadActivityEcho();
  const events = activityEcho.collectEvents({
    activeSeed: { id: "terra", title: "TERRA", updatedAt: "2026-07-13T10:00:00.000Z" },
    runtimeRecord: {
      operationId: "operation-1",
      status: "running",
      activity: "Octopus prépare une tentative",
      updatedAt: "2026-07-13T10:03:00.000Z",
      harvest: { id: "harvest-runtime", title: "Récolte runtime" }
    },
    runtimeError: "Publisher inaccessible",
    draft: {
      id: "draft-1",
      status: "prepared",
      objective: "Préparer une sortie",
      grafts: ["Lovable"],
      updatedAt: "2026-07-13T10:01:00.000Z"
    }
  });

  assert.deepEqual(
    new Set(events.map((event) => event.status)),
    new Set(["observation", "preparation", "reflexion", "experimentation", "recolte", "blocage"])
  );
});

test("ActivityEcho renders the Lovable constellation instead of a simple list", () => {
  const activityEcho = loadActivityEcho();
  const html = activityEcho.render([
    { id: "seed:terra", pole: "radar", label: "Nouvelle graine repérée · TERRA", status: "observation", at: Date.parse("2026-07-13T10:00:00.000Z") },
    { id: "harvest:terra", pole: "garden", label: "Une récolte revient au Garden · Landing page", status: "recolte", at: Date.parse("2026-07-13T10:01:00.000Z") }
  ]);

  assert.match(html, /class="ae-svg"/);
  assert.match(html, /data-activity-pole="radar"/);
  assert.match(html, /data-activity-pole="garden"/);
  assert.match(html, /class="ae-creature"/);
  assert.match(html, /class="ae-timeline"/);
});

test("ActivityEcho renders an adventure notebook with read-only progress", () => {
  const activityEcho = loadActivityEcho();
  const html = activityEcho.render([
    {
      id: "seed:terra",
      pole: "radar",
      label: "Nouvelle graine repÃ©rÃ©e Â· TERRA",
      title: "GÃ©rard explore la serre",
      detail: "Une Seed attire son attention.",
      status: "observation",
      at: Date.parse("2026-07-13T10:00:00.000Z")
    },
    {
      id: "draft:terra",
      pole: "publisher",
      label: "GÃ©rard prÃ©pare son sac Â· TERRA",
      title: "GÃ©rard prÃ©pare son sac",
      detail: "Les connaissances utiles sont sÃ©lectionnÃ©es.",
      status: "preparation",
      technical: true,
      at: Date.parse("2026-07-13T10:01:00.000Z")
    },
    {
      id: "harvest:terra",
      pole: "garden",
      label: "Une rÃ©colte revient au Garden Â· Landing page",
      title: "RÃ©colte disponible",
      detail: "Une nouvelle rÃ©colte peut Ãªtre examinÃ©e.",
      status: "recolte",
      at: Date.parse("2026-07-13T10:02:00.000Z")
    }
  ]);

  assert.match(html, /aria-label="Carnet d'aventure de G.rard"/);
  assert.match(html, /class="ae-progress"/);
  assert.match(html, /Seed/);
  assert.match(html, /Sac/);
  assert.match(html, /D.part/);
  assert.match(html, /Mistral/);
  assert.match(html, /R.colte/);
  assert.match(html, /D.tails techniques/);
});
