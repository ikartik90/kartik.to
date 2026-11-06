// @vitest-environment node
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSheets, type Sheets } from "../sheets.ts";

const fixture = (name: string) => join(import.meta.dirname, "fixtures", name);
let sheets: Sheets;

beforeAll(async () => {
  sheets = await loadSheets(process.cwd(), [join(import.meta.dirname, "fixtures", "*.tsx")]);
}, 60_000);

describe("loadSheets", () => {
  it("writes only the styles the given files use", () => {
    const css = sheets.css([fixture("first.tsx")]);
    expect(css).toContain("z-index: 7341");
    expect(css).not.toContain("z-index: 7342");
  });

  it("writes the styles of every file given, in the stylesheet's own order", () => {
    const css = sheets.css([fixture("second.tsx"), fixture("first.tsx")]);
    const at = (text: string) => css.indexOf(text);
    expect(at("z-index: 7341")).toBeGreaterThan(-1);
    expect(at("z-index: 7342")).toBeGreaterThan(-1);
    expect(at("z-index: 7343")).toBeGreaterThan(Math.max(at("z-index: 7341"), at("z-index: 7342")));
  });

  it("holds the reset, the globals and the tokens in their layers' order, so each sheet stands alone", () => {
    const css = sheets.css([fixture("first.tsx")]);
    const order = ["@layer reset", "@layer base", "@layer tokens", "@layer utilities"].map((layer) => css.indexOf(layer));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("minifies when asked", () => {
    const css = sheets.css([fixture("first.tsx")], { minify: true });
    expect(css).toContain("z-index:7341");
    expect(css).not.toContain("\n  ");
  });
});
