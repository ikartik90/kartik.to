import { describe, it, expect } from "vitest";
import {
  formatSliderValue,
  ratioOfValue,
  snapToStep,
  tickRatios,
  valueAtRatio,
} from "../slider-value";

describe("snapToStep", () => {
  const scale = { min: 0, max: 100, step: 10 };

  it("clamps outside the range", () => {
    expect(snapToStep(-40, scale)).toBe(0);
    expect(snapToStep(140, scale)).toBe(100);
  });

  it("snaps to the nearest step, rounding halves up", () => {
    expect(snapToStep(43, scale)).toBe(40);
    expect(snapToStep(45, scale)).toBe(50);
    expect(snapToStep(47, scale)).toBe(50);
  });

  it("anchors the grid at min, not at zero", () => {
    // Grid is 5, 15, 25 … — 12 is nearer 15 than 5.
    expect(snapToStep(12, { min: 5, max: 100, step: 10 })).toBe(15);
    expect(snapToStep(9, { min: 5, max: 100, step: 10 })).toBe(5);
  });

  it("never returns a value past max when max is off the grid", () => {
    // Grid is 0, 3, 6, 9 — 12 would overshoot the range entirely.
    expect(snapToStep(10, { min: 0, max: 10, step: 3 })).toBe(9);
    expect(snapToStep(11, { min: 0, max: 10, step: 3 })).toBe(9);
  });

  it("handles a negative range", () => {
    expect(snapToStep(-7, { min: -10, max: 10, step: 5 })).toBe(-5);
    expect(snapToStep(-100, { min: -10, max: 10, step: 5 })).toBe(-10);
  });

  it("stays decimal-safe on fractional steps", () => {
    const tenths = { min: 0, max: 1, step: 0.1 };
    // 0.1 * 3 is 0.30000000000000004 in binary floating point.
    expect(snapToStep(0.3, tenths)).toBe(0.3);
    expect(snapToStep(0.35, tenths)).toBe(0.4);
    expect(snapToStep(0.74, tenths)).toBe(0.7);
  });

  it("clamps without snapping when the step is not positive", () => {
    expect(snapToStep(43.7, { min: 0, max: 100, step: 0 })).toBe(43.7);
    expect(snapToStep(143.7, { min: 0, max: 100, step: -1 })).toBe(100);
  });

  it("falls back to min for a value that is not a number", () => {
    expect(snapToStep(Number.NaN, scale)).toBe(0);
  });
});

describe("valueAtRatio", () => {
  const scale = { min: 0, max: 100, step: 10 };

  it("maps the track ends to the range ends", () => {
    expect(valueAtRatio(0, scale)).toBe(0);
    expect(valueAtRatio(1, scale)).toBe(100);
  });

  it("snaps the value under the pointer to the step grid", () => {
    expect(valueAtRatio(0.44, scale)).toBe(40);
    expect(valueAtRatio(0.46, scale)).toBe(50);
  });

  it("clamps a pointer dragged past either end", () => {
    expect(valueAtRatio(-0.5, scale)).toBe(0);
    expect(valueAtRatio(1.5, scale)).toBe(100);
  });

  it("maps through a negative range", () => {
    expect(valueAtRatio(0.5, { min: -10, max: 10, step: 1 })).toBe(0);
  });
});

describe("ratioOfValue", () => {
  it("returns the fraction of the track the value sits at", () => {
    expect(ratioOfValue(0, { min: 0, max: 100 })).toBe(0);
    expect(ratioOfValue(25, { min: 0, max: 100 })).toBe(0.25);
    expect(ratioOfValue(100, { min: 0, max: 100 })).toBe(1);
  });

  it("clamps values outside the range", () => {
    expect(ratioOfValue(-20, { min: 0, max: 100 })).toBe(0);
    expect(ratioOfValue(120, { min: 0, max: 100 })).toBe(1);
  });

  it("returns 0 for a degenerate range rather than dividing by zero", () => {
    expect(ratioOfValue(5, { min: 5, max: 5 })).toBe(0);
  });
});

describe("formatSliderValue", () => {
  it("shows no decimals for a whole-number step", () => {
    expect(formatSliderValue(100, 1)).toBe("100");
    expect(formatSliderValue(0, 10)).toBe("0");
  });

  it("matches the step's precision so the readout cannot jitter mid-drag", () => {
    expect(formatSliderValue(0.3, 0.1)).toBe("0.3");
    expect(formatSliderValue(1, 0.25)).toBe("1.00");
    expect(formatSliderValue(0.5, 0.25)).toBe("0.50");
  });

  it("never renders a signed zero", () => {
    expect(formatSliderValue(-0, 1)).toBe("0");
  });
});

describe("tickRatios", () => {
  it("draws one mark per value when the scale holds 11 or fewer", () => {
    // The God Rays colour count: 1–5 can only ever be five numbers, so eleven
    // marks would promise six stops the thumb cannot visit.
    expect(tickRatios({ min: 1, max: 5, step: 1 })).toEqual([
      0, 0.25, 0.5, 0.75, 1,
    ]);
  });

  it("still draws every value at exactly 11", () => {
    expect(tickRatios({ min: 0, max: 10, step: 1 })).toHaveLength(11);
  });

  it("caps a denser scale at 11 marks spread across the range", () => {
    // 0–1 by hundredths is 101 stops; the ruler shows a tenth of the range.
    expect(tickRatios({ min: 0, max: 1, step: 0.01 })).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
    ]);
  });

  it("caps a continuous scale at 11 marks", () => {
    expect(tickRatios({ min: 0, max: 100, step: 0 })).toHaveLength(11);
  });

  it("ends the ruler where the thumb ends when max is off the grid", () => {
    // Grid is 0, 3, 6, 9 — snapToStep can never reach 10, so neither does a mark.
    expect(tickRatios({ min: 0, max: 10, step: 3 })).toEqual([0, 0.3, 0.6, 0.9]);
  });

  it("does not lose a stop to float error in the division", () => {
    // (0.5 - 0) / 0.1 is 4.999999999999999 — six stops, not five.
    expect(tickRatios({ min: 0, max: 0.5, step: 0.1 })).toEqual([
      0, 0.2, 0.4, 0.6, 0.8, 1,
    ]);
  });

  it("collapses a degenerate range to a single mark", () => {
    expect(tickRatios({ min: 5, max: 5, step: 1 })).toEqual([0]);
  });

  it("spreads an explicitly requested count evenly, whatever the scale", () => {
    expect(tickRatios({ min: 0, max: 100, step: 1 }, 5)).toEqual([
      0, 0.25, 0.5, 0.75, 1,
    ]);
    expect(tickRatios({ min: 0, max: 100, step: 1 }, 1)).toEqual([0]);
    expect(tickRatios({ min: 0, max: 100, step: 1 }, 0)).toEqual([]);
  });
});
