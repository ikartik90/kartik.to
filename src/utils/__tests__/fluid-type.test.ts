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
    expect(fluid(16, 20, viewports, "cqi")).toBe(
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

describe("fluidLineHeight", () => {
  it("rounds the in-between line heights to the grid it's given", () => {
    expect(fluidLineHeight(size, viewports, "4px")).toBe(
      "round(clamp(1.5rem, 1.3239rem + 0.7512vw, 2rem), 4px)",
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
    expect(fluidLineHeight(fixed, viewports, "4px")).toBe("3.375rem");
  });
});
