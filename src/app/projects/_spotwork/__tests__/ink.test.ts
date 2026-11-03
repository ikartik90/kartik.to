import { describe, expect, it } from "vitest";
import { centringOf } from "../ink";

// A 16px badge whose letter starts 4px in, on a baseline 14px down.
const BADGE = { width: 16, height: 16 };
const ORIGIN = { left: 4, baseline: 14 };

describe("centringOf", () => {
  it("moves a letter whose ink sits right of and below the middle back onto it", () => {
    // Ink from 1px to 8px along the line, 10px above the baseline to 0 below: its middle at (8.5, 9).
    const { x, y } = centringOf(BADGE, ORIGIN, { left: 1, right: 8, top: 10, bottom: 0 });
    expect(x).toBeCloseTo(-0.5);
    expect(y).toBeCloseTo(-1);
  });

  it("leaves a letter whose ink is already in the middle where it is", () => {
    const { x, y } = centringOf(BADGE, ORIGIN, { left: 0, right: 8, top: 11, bottom: -1 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it("counts a descender's depth below the baseline", () => {
    // Ink 9px above the baseline to 3px below: its middle 3px above the baseline, at 11.
    const { y } = centringOf(BADGE, ORIGIN, { left: 0, right: 8, top: 9, bottom: 3 });
    expect(y).toBeCloseTo(-3);
  });
});
