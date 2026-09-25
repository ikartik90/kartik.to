import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import type { GridCard } from "@/lib/grid";

// The real reel reaches the database; only the routing is under test.
vi.mock("@/components/shader-preset-reel", () => ({
  ShaderPresetReel: function ShaderPresetReel() {
    return null;
  },
}));

// The weather card's server half calls an external service.
vi.mock("@/lib/weather", () => ({ getCurrentWeather: async () => null }));

const { serverDemoSlots, serverDemos } = await import("../server-demos");
const { ShaderPresetReel } = await import("@/components/shader-preset-reel");

const component = (id: string, componentId: string): GridCard => ({
  kind: "component",
  key: `component:${id}`,
  id,
  componentId,
  logger: false,
  props: null,
  gridIndex: null,
  publishedAt: new Date("2026-01-01"),
  aspect: "1/1",
  span: 1,
});

const post = (id: string): GridCard => ({
  kind: "post",
  key: `post:${id}`,
  id,
  title: id,
  href: `/work/${id}`,
  date: null,
  cover: null,
  card: {},
  gridIndex: null,
  publishedAt: new Date("2026-01-01"),
  aspect: "16/9",
  span: 1,
});

describe("serverDemoSlots", () => {
  it("renders the reel on the server, keyed by the card and not the demo", () => {
    const slots = serverDemoSlots([component("a", "shader-preset-reel")]);

    expect(Object.keys(slots)).toEqual(["component:a"]);
    expect((slots["component:a"] as ReactElement).type).toBe(ShaderPresetReel);
  });

  it("hands the demo the card's own aspect", () => {
    const wide = { ...component("a", "shader-preset-reel"), aspect: "16/9" as const };
    const slots = serverDemoSlots([wide]);

    expect((slots["component:a"] as ReactElement).props).toEqual({
      aspect: "16/9",
    });
  });

  it("leaves every demo that has no server half to the browser", () => {
    expect(serverDemoSlots([component("a", "calchemy-demo")])).toEqual({});
  });

  it("ignores posts, which have no demo to render", () => {
    expect(serverDemoSlots([post("a")])).toEqual({});
  });

  it("renders each showing of a twice-published demo separately", () => {
    const slots = serverDemoSlots([
      component("a", "shader-preset-reel"),
      { ...component("b", "shader-preset-reel"), aspect: "16/9" as const },
    ]);

    expect(Object.keys(slots)).toEqual(["component:a", "component:b"]);
    expect((slots["component:a"] as ReactElement).props).toEqual({ aspect: "1/1" });
    expect((slots["component:b"] as ReactElement).props).toEqual({ aspect: "16/9" });
  });

  it("names only the demos that have a server half", () => {
    expect(Object.keys(serverDemos)).toEqual([
      "shader-preset-reel",
      "weather-widget",
    ]);
  });
});
