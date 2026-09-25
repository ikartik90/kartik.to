import { describe, expect, it } from "vitest";
import { SITE_PAGES, SITE_PATHS, sitePathTitle } from "../site-paths";

describe("SITE_PAGES", () => {
  it("gives each page its public name", () => {
    expect(SITE_PAGES.shader.title).toBe("Waveform Studio");
    expect(SITE_PAGES.calchemy.title).toBe(
      "Calchemy: Natural-Language Date Parser",
    );
    expect(SITE_PAGES.icons.title).toBe(
      "Crest Icons: 300+ Handcrafted SVG Icons",
    );
  });

  it("gives each page a short name for the picker", () => {
    expect(SITE_PAGES.shader.label).toBe("Shader Playground");
    expect(SITE_PAGES.calchemy.label).toBe("Calchemy Playground");
    expect(SITE_PAGES.icons.label).toBe("Icons Playground");
  });
});

describe("SITE_PATHS", () => {
  it("lists every page, in the picker's order", () => {
    expect(SITE_PATHS.map((page) => page.path)).toEqual([
      "/playground/shader",
      "/playground/calchemy",
      "/playground/icons",
    ]);
  });
});

describe("sitePathTitle", () => {
  it("is the public name of a listed page", () => {
    expect(sitePathTitle("/playground/shader")).toBe("Waveform Studio");
  });

  it("is nothing for a path the list does not hold", () => {
    expect(sitePathTitle("/vouch")).toBeUndefined();
  });
});
