import { describe, expect, it } from "vitest";
import { parseSnapshot, projectMissions } from "@/garden-gege/core.mjs";
import { demoSnapshot } from "@/garden-gege/demo";
import { ROLE_ORDER, ROLE_VISUALS } from "@/garden-gege/roles";
import { poseFor } from "@/components/garden/scene-model";

describe("Jardin des Gégé", () => {
  it("keeps all seven trades in the model", () => {
    expect(ROLE_ORDER).toHaveLength(7);
    expect(Object.keys(ROLE_VISUALS)).toHaveLength(7);
  });
  it("animates exactly cueilleur, passeur and greffeur in v1", () => {
    expect(ROLE_ORDER.filter((r) => ROLE_VISUALS[r].animated)).toEqual(["cueilleur", "passeur", "greffeur"]);
  });
  it("real reader rejects demo fixtures", () => {
    expect(() => parseSnapshot(demoSnapshot, "real")).toThrow();
  });
  it("a trade with no mission rests instead of pretending to work", () => {
    expect(poseFor(undefined, "cueilleur")).toBe("idle");
  });
  it("demo snapshot projects seven missions", () => {
    const s = parseSnapshot(structuredClone(demoSnapshot), "demo");
    expect(projectMissions(s.events, "demo")).toHaveLength(7);
  });
});

import { gerardMood } from "@/components/garden/scene-model";
describe("Gérard mood comes only from observed statuses", () => {
  const m = (status: string) => ({ status }) as never;
  it("busy when a mission runs", () => expect(gerardMood([m("running"), m("failed")])).toBe("busy"));
  it("concerned when only failures remain", () => expect(gerardMood([m("failed"), m("completed")])).toBe("concerned"));
  it("calm with no missions", () => expect(gerardMood([])).toBe("calm"));
});