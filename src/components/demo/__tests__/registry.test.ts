import { describe, it, expect } from "vitest";
import { demoComponents, getDemoComponent } from "../registry";

describe("demo component registry", () => {
  it("registers every demo, sorted by label with a lazy loader", () => {
    expect(demoComponents.map((demo) => demo.id)).toEqual([
      "calchemy-demo",
      "shift-scheduling-v0",
      "shift-scheduling-v1",
      "shift-scheduling-v2",
    ]);
    for (const demo of demoComponents) {
      expect(typeof demo.load).toBe("function");
    }
  });

  it("resolves calchemy-demo by id", () => {
    expect(getDemoComponent("calchemy-demo")).toMatchObject({
      id: "calchemy-demo",
      label: "Calchemy Demo",
    });
  });

  it("resolves shift-scheduling-v1 by id", () => {
    expect(getDemoComponent("shift-scheduling-v1")).toMatchObject({
      id: "shift-scheduling-v1",
      label: "Shift Scheduling V1",
    });
  });

  it("resolves shift-scheduling-v2 by id", () => {
    expect(getDemoComponent("shift-scheduling-v2")).toMatchObject({
      id: "shift-scheduling-v2",
      label: "Shift Scheduling V2",
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(getDemoComponent("nope")).toBeUndefined();
  });
});
