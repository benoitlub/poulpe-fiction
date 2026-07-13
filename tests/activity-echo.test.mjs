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
});

test("ActivityEcho translates Garden sources into typed Garden events", () => {
  const activityEcho = loadActivityEcho();
  const events = activityEcho.collectEvents({
    activeSeed: { id: "terra", title: "TERRA", updatedAt: "2026-07-13T10:00:00.000Z" },
    draft: {
      id: "draft-1",
      status: "prepared",
      objective: "Préparer une sortie",
      grafts: ["Lovable"],
      updatedAt: "2026-07-13T10:01:00.000Z"
    },
    returnBundles: [{
      id: "return-1",
      createdAt: "2026-07-13T10:02:00.000Z",
      harvests: [{ id: "harvest-1", title: "Landing page", createdAt: "2026-07-13T10:02:00.000Z" }],
      seeds: []
    }]
  });

  assert.equal(events.some((event) => event.label === "Nouvelle graine repérée"), true);
  assert.equal(events.some((event) => event.label === "Gérard prépare son sac"), true);
  assert.equal(events.some((event) => event.label === "Un greffon est consulté"), true);
  assert.equal(events.some((event) => event.label === "Une récolte revient au Garden"), true);
});

test("ActivityEcho reports blocking thorns from runtime errors", () => {
  const activityEcho = loadActivityEcho();
  const events = activityEcho.collectEvents({ runtimeError: "Publisher inaccessible" });
  assert.equal(events[0].label, "Une épine bloque la sortie");
  assert.equal(events[0].tone, "error");
});
