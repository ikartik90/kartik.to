import { describe, it, expect } from "vitest";
import { demoComponents, getDemoComponent } from "../registry";

describe("demo component registry", () => {
  it("registers every demo, sorted by label with a lazy loader", () => {
    expect(demoComponents.map((demo) => demo.id)).toEqual([
      "calchemy-demo",
      "position-fields-consolidation",
      "scheduling-layout-redesign",
      "shader-preset-reel",
      "shift-scheduling-v0",
      "shift-scheduling-v1",
      "shift-scheduling-v2",
      "weather-widget",
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

  it("resolves scheduling-layout-redesign by id", () => {
    expect(getDemoComponent("scheduling-layout-redesign")).toMatchObject({
      id: "scheduling-layout-redesign",
      label: "Scheduling Layout Redesign",
    });
  });

  // The reel is the one entry that is not a self-contained toy: it is a
  // PICTURE of the shader playground, so its card is drawn square (the shape
  // presets are authored at) and points at the thing it is a picture of.
  it("resolves shader-preset-reel by id, squared and linked to the playground", () => {
    expect(getDemoComponent("shader-preset-reel")).toMatchObject({
      id: "shader-preset-reel",
      label: "Shader Preset Reel",
      aspectRatio: "1/1",
      link: { href: "/playground/shader", label: "Shader playground" },
    });
  });

  // Every other demo is played where it stands, and a card that navigated away
  // from one would be taking the reader out of a demo they were using.
  it("gives no link to the demos that are played in place", () => {
    for (const demo of demoComponents) {
      if (demo.id !== "shader-preset-reel") expect(demo.link).toBeUndefined();
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getDemoComponent("nope")).toBeUndefined();
  });
});
