import { describe, it, expect } from "vitest";
import { demoComponents, getDemoComponent } from "../registry";

describe("demo component registry", () => {
  it("registers every demo, sorted by label with a lazy loader", () => {
    expect(demoComponents.map((demo) => demo.id)).toEqual([
      "calchemy-demo",
      "shift-scheduling",
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

  it("resolves shift-scheduling by id", () => {
    expect(getDemoComponent("shift-scheduling")).toMatchObject({
      id: "shift-scheduling",
      label: "Shift Scheduling",
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(getDemoComponent("nope")).toBeUndefined();
  });
});
