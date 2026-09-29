import { describe, expect, it } from "vitest";
import { fluid, fluidFontSize, fluidLineHeight } from "../fluid-type";

const viewports = { mobile: 375, desktop: 1440 };

describe("fluid", () => {
  it("runs from the mobile value at the mobile width to the desktop value at the desktop width", () => {
    expect(fluid(16, 20, viewports)).toBe(
      "clamp(1rem, 0.912rem + 0.3756vw, 1.25rem)",
    );
  });

  it("shrinks when mobile is the larger", () => {
    expect(fluid(20, 16, viewports)).toBe(
      "clamp(1rem, 1.338rem - 0.3756vw, 1.25rem)",
    );
  });

  it("is a plain value when both ends match", () => {
    expect(fluid(16, 16, viewports)).toBe("1rem");
  });

  it("takes another unit for the viewport", () => {
    expect(fluid(16, 20, viewports, { unit: "cqi" })).toBe(
      "clamp(1rem, 0.912rem + 0.3756cqi, 1.25rem)",
    );
  });
});

const size = {
  mobile: { size: 16, lineHeight: 24 },
  desktop: { size: 20, lineHeight: 32 },
};

describe("fluidFontSize", () => {
  it("runs between the two sizes", () => {
    expect(fluidFontSize(size, viewports)).toBe(
      "clamp(1rem, 0.912rem + 0.3756vw, 1.25rem)",
    );
  });
});

/** Evaluates the CSS this module writes, at one viewport width, the way a browser would. */
function evaluate(css: string, width: number): number {
  const rem = (value: string) => parseFloat(value) * 16;
  const plain = /^([\d.]+)rem$/.exec(css);
  if (plain) return rem(plain[1]);
  const fluid =
    /^clamp\(([\d.]+)rem, (?:round\()?([\d.]+)rem ([+-]) ([\d.]+)vw(?:, (\d+)px\))?, ([\d.]+)rem\)$/.exec(
      css,
    );
  if (!fluid) throw new Error(`Unexpected CSS: ${css}`);
  const [, low, base, sign, perViewport, grid, high] = fluid;
  let value =
    rem(base) + (sign === "+" ? 1 : -1) * ((parseFloat(perViewport) * width) / 100);
  if (grid) value = Math.round(value / Number(grid)) * Number(grid);
  return Math.min(rem(high), Math.max(rem(low), value));
}

const grid = { px: 4, css: "4px" };
const widths = Array.from({ length: 107 }, (_, i) => 375 + i * 10);

describe("fluidLineHeight", () => {
  it.each([
    ["on the grid", 24, 32],
    ["off the grid", 28, 42],
    ["falling", 32, 26],
  ])("keeps both ends exact, %s", (_, mobile, desktop) => {
    const css = fluidLineHeight(
      {
        mobile: { size: 16, lineHeight: mobile },
        desktop: { size: 20, lineHeight: desktop },
      },
      viewports,
      grid,
    );
    expect(evaluate(css, 320)).toBe(mobile);
    expect(evaluate(css, 375)).toBe(mobile);
    expect(evaluate(css, 1440)).toBe(desktop);
    expect(evaluate(css, 1920)).toBe(desktop);
  });

  it("puts every in-between value on the grid", () => {
    const css = fluidLineHeight(
      {
        mobile: { size: 16, lineHeight: 28 },
        desktop: { size: 20, lineHeight: 42 },
      },
      viewports,
      grid,
    );
    const seen = new Set(widths.map((width) => evaluate(css, width)));
    for (const value of seen) {
      expect(value === 42 || value % 4 === 0).toBe(true);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([28, 32, 36, 40, 42]);
  });

  it("writes the grid's own value into the rounding", () => {
    expect(fluidLineHeight(size, viewports, { px: 4, css: "{spacing.sm}" })).toMatch(
      /^clamp\(1\.5rem, round\(.+, \{spacing\.sm\}\), 2rem\)$/,
    );
  });

  it("stays exact without a grid", () => {
    expect(fluidLineHeight(size, viewports)).toBe(
      "clamp(1.5rem, 1.3239rem + 0.7512vw, 2rem)",
    );
  });

  it("never moves a line height that doesn't change", () => {
    const fixed = {
      mobile: { size: 36, lineHeight: 54 },
      desktop: { size: 40, lineHeight: 54 },
    };
    expect(fluidLineHeight(fixed, viewports, grid)).toBe("3.375rem");
  });
});
