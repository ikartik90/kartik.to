import { describe, it, expect } from "vitest";
import { demoComponents, getDemoComponent } from "../registry";

describe("demo component registry", () => {
  it("registers calchemy-demo", () => {
    expect(demoComponents).toHaveLength(1);
    expect(demoComponents[0]).toMatchObject({
      id: "calchemy-demo",
      label: "Calchemy Demo",
    });
    expect(typeof demoComponents[0]?.load).toBe("function");
  });

  it("resolves calchemy-demo by id", () => {
    expect(getDemoComponent("calchemy-demo")).toMatchObject({
      id: "calchemy-demo",
      label: "Calchemy Demo",
    });
  });
});
