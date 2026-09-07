import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import type { GridCard } from "@/lib/grid";

// The real one reaches the database through a server action. What is under test
// is the ROUTING — which cards get a server-rendered demo and what it is handed
// — so the reel stands in as a marker component.
vi.mock("@/components/shader-preset-reel", () => ({
  ShaderPresetReel: function ShaderPresetReel() {
    return null;
  },
}));

// Likewise the weather card, whose server half calls an external service.
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
    // The KEY is the card's, because the same demo is publishable twice and the
    // two showings are different elements — a map keyed by `componentId` would
    // hand both cards whichever one was built last, at one card's aspect.
    const slots = serverDemoSlots([component("a", "shader-preset-reel")]);

    expect(Object.keys(slots)).toEqual(["component:a"]);
    expect((slots["component:a"] as ReactElement).type).toBe(ShaderPresetReel);
  });

  it("hands the demo the card's own aspect", () => {
    // Not the registry's: a row may override the shape, and the reel frames its
    // shapes for the box it is told it is in. A card published at 16:9 that was
    // drawn framed for a square is the bug this exists to prevent.
    const wide = { ...component("a", "shader-preset-reel"), aspect: "16/9" as const };
    const slots = serverDemoSlots([wide]);

    expect((slots["component:a"] as ReactElement).props).toEqual({
      aspect: "16/9",
    });
  });

  it("leaves every demo that has no server half to the browser", () => {
    // Absent, not null: `ComponentCard` falls back to the client loader on a
    // missing key, so a demo opting out of server rendering costs no branch
    // here and keeps working exactly as it did.
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

  // The registry is the catalogue of demos this codebase has; this is the much
  // shorter list of the ones whose data is fetched before the page is sent.
  it("names only the demos that have a server half", () => {
    expect(Object.keys(serverDemos)).toEqual([
      "shader-preset-reel",
      "weather-widget",
    ]);
  });
});
