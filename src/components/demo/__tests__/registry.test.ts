import { describe, it, expect } from "vitest";
import { demoComponents, getDemoComponent, pendingInsertFor } from "../registry";

describe("demo component registry", () => {
  it("registers every demo, sorted by label with a lazy loader", () => {
    expect(demoComponents.map((demo) => demo.id)).toEqual([
      "calchemy-demo",
      "link-card",
      "position-fields-consolidation",
      "scheduling-layout-redesign",
      "shader-preset-reel",
      "shift-scheduling-v0",
      "shift-scheduling-v1",
      "shift-scheduling-v2",
      "weather-widget",
    ]);
    for (const demo of demoComponents) {
      expect(typeof demo.load).toBe(demo.card ? "undefined" : "function");
    }
  });

  it("resolves link-card by id, as a card with no module behind it", () => {
    expect(getDemoComponent("link-card")).toMatchObject({
      id: "link-card",
      label: "Link Card",
      card: true,
      aspectRatio: "16/9",
    });
    expect(getDemoComponent("link-card")?.load).toBeUndefined();
  });

  it("marks nothing else as a card", () => {
    for (const demo of demoComponents) {
      if (demo.id !== "link-card") expect(demo.card).toBeUndefined();
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

  it("resolves shader-preset-reel by id, squared and linked to the playground", () => {
    expect(getDemoComponent("shader-preset-reel")).toMatchObject({
      id: "shader-preset-reel",
      label: "Shader Preset Reel",
      aspectRatio: "1/1",
      link: { href: "/playground/shader", label: "Shader playground" },
    });
  });

  it("gives no link to the demos that are played in place", () => {
    for (const demo of demoComponents) {
      if (demo.id !== "shader-preset-reel") expect(demo.link).toBeUndefined();
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getDemoComponent("nope")).toBeUndefined();
  });
});

describe("pendingInsertFor", () => {
  it("takes the registry's shape as the card's default", () => {
    expect(pendingInsertFor("scheduling-layout-redesign", 3)).toMatchObject({
      componentId: "scheduling-layout-redesign",
      index: 3,
      aspect: "2/1",
      logger: false,
    });
  });

  it("opens the log panel for a demo the registry logs", () => {
    expect(pendingInsertFor("calchemy-demo", 0).logger).toBe(true);
  });

  it("falls back to 3/2 for an entry that names no shape", () => {
    expect(pendingInsertFor("calchemy-demo", 0).aspect).toBe("3/2");
  });

  it("carries a null seat through, for a widget chosen from a list", () => {
    expect(pendingInsertFor("link-card", null).index).toBeNull();
  });

  it("hands out a distinct key every time", () => {
    const first = pendingInsertFor("link-card", null).key;
    const second = pendingInsertFor("link-card", null).key;
    expect(first).not.toBe(second);
    expect(first).toMatch(/^pending:/);
  });
});
